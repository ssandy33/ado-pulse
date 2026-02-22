import { NextRequest, NextResponse } from "next/server";
import { parseRange, resolveRange } from "@/lib/dateRange";
import { logger } from "@/lib/logger";

/**
 * Raw identity debug endpoint — makes direct ADO API calls without
 * using any lib functions that might normalize or transform data.
 * Returns raw values exactly as ADO returns them so identity
 * mismatches are immediately visible.
 */

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(":" + pat).toString("base64")}`;
}

async function rawAdoFetch<T>(pat: string, url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader(pat),
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`ADO API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

interface RawTeamMember {
  identity: {
    id: string;
    displayName: string;
    uniqueName: string;
    descriptor?: string;
    subjectKind?: string;
    origin?: string;
    [key: string]: unknown;
  };
}

interface RawPullRequest {
  pullRequestId: number;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
}

interface AdoListResponse<T> {
  count: number;
  value: T[];
}

interface RawTeam {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const org = request.headers.get("x-ado-org");
  const project = request.headers.get("x-ado-project");
  const pat = request.headers.get("x-ado-pat");

  if (!org || !project || !pat) {
    return NextResponse.json(
      { error: "Missing x-ado-org, x-ado-project, or x-ado-pat headers" },
      { status: 401 }
    );
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const { from, days, label } = resolveRange(range);
  const teamName = request.nextUrl.searchParams.get("team") || "";

  logger.info("Request start", { route: "debug/identity-check", team: teamName, range: request.nextUrl.searchParams.get("range") });

  if (!teamName) {
    return NextResponse.json({ error: "No team specified" }, { status: 400 });
  }

  try {
    // 1. Resolve team ID
    const teamsUrl = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`;
    const teamsData = await rawAdoFetch<AdoListResponse<RawTeam>>(pat, teamsUrl);
    const team = teamsData.value.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      return NextResponse.json(
        { error: `Team "${teamName}" not found` },
        { status: 404 }
      );
    }

    // 2. Fetch raw team members
    const membersUrl = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team.id)}/members?api-version=7.1`;

    // 3. Fetch raw PRs
    const minTime = from.toISOString();
    const prsUrl = `https://dev.azure.com/${org}/${project}/_apis/git/pullrequests?searchCriteria.status=completed&searchCriteria.minTime=${encodeURIComponent(minTime)}&$top=500&api-version=7.1`;

    const [membersData, prsData] = await Promise.all([
      rawAdoFetch<AdoListResponse<RawTeamMember>>(pat, membersUrl),
      rawAdoFetch<AdoListResponse<RawPullRequest>>(pat, prsUrl),
    ]);

    const rawMembers = membersData.value;
    const rawPRs = prsData.value;
    const apiLimitHit = rawPRs.length === 500;

    // Build unique PR authors map
    const prAuthorMap = new Map<
      string,
      { raw: { id: string; displayName: string; uniqueName: string }; prCount: number }
    >();
    for (const pr of rawPRs) {
      const key = pr.createdBy.uniqueName;
      const existing = prAuthorMap.get(key);
      if (existing) {
        existing.prCount++;
      } else {
        prAuthorMap.set(key, {
          raw: { ...pr.createdBy },
          prCount: 1,
        });
      }
    }

    // Build roster-to-author matching
    const rosterMembers = rawMembers.map((m) => {
      const rosterUnique = m.identity.uniqueName;

      // Try exact match first
      let matchedAuthorUniqueName: string | null = null;
      let matchType: "exact" | "lowercase" | "none" = "none";
      let matchedPRCount = 0;

      for (const [authorUnique, authorData] of prAuthorMap) {
        if (rosterUnique === authorUnique) {
          matchedAuthorUniqueName = authorUnique;
          matchType = "exact";
          matchedPRCount = authorData.prCount;
          break;
        }
      }

      // If no exact match, try lowercase
      if (matchType === "none") {
        const rosterLower = rosterUnique.toLowerCase();
        for (const [authorUnique, authorData] of prAuthorMap) {
          if (rosterLower === authorUnique.toLowerCase()) {
            matchedAuthorUniqueName = authorUnique;
            matchType = "lowercase";
            matchedPRCount = authorData.prCount;
            break;
          }
        }
      }

      return {
        raw: {
          id: m.identity.id,
          displayName: m.identity.displayName,
          uniqueName: m.identity.uniqueName,
          ...(m.identity.descriptor && { descriptor: m.identity.descriptor }),
          ...(m.identity.subjectKind && { subjectKind: m.identity.subjectKind as string }),
          ...(m.identity.origin && { origin: m.identity.origin as string }),
        },
        matchedAuthorUniqueName,
        matchedPRCount,
        matchType,
      };
    });

    // Sort: unmatched first, then by display name
    rosterMembers.sort((a, b) => {
      if (a.matchType === "none" && b.matchType !== "none") return -1;
      if (a.matchType !== "none" && b.matchType === "none") return 1;
      return a.raw.displayName.localeCompare(b.raw.displayName);
    });

    // Build PR authors with roster match info
    const rosterLowerSet = new Map<string, string>();
    for (const m of rawMembers) {
      rosterLowerSet.set(
        m.identity.uniqueName.toLowerCase(),
        m.identity.displayName
      );
    }

    const prAuthors = Array.from(prAuthorMap.entries())
      .map(([, authorData]) => ({
        raw: authorData.raw,
        prCount: authorData.prCount,
        matchedRosterMember:
          rosterLowerSet.get(authorData.raw.uniqueName.toLowerCase()) ?? null,
      }))
      .sort((a, b) => {
        // Matched first, then by PR count desc
        if (a.matchedRosterMember && !b.matchedRosterMember) return -1;
        if (!a.matchedRosterMember && b.matchedRosterMember) return 1;
        return b.prCount - a.prCount;
      });

    const unmatchedRosterMembers = rosterMembers
      .filter((m) => m.matchType === "none")
      .map((m) => m.raw.uniqueName);

    const unmatchedPRAuthors = prAuthors
      .filter((a) => !a.matchedRosterMember)
      .map((a) => a.raw.uniqueName);

    const now = new Date();

    const response = {
      period: { days, from: from.toISOString(), to: now.toISOString(), label },
      apiLimitHit,
      team: { id: team.id, name: team.name },
      rosterMembers,
      prAuthors,
      unmatchedRosterMembers,
      unmatchedPRAuthors,
    };

    // No cache — always fresh for diagnostic tool
    logger.info("Request complete", { route: "debug/identity-check", durationMs: Date.now() - start });
    return NextResponse.json(response);
  } catch (error) {
    logger.error("Request error", { route: "debug/identity-check", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

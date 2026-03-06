import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests } from "@/lib/ado/pullRequests";
import { buildPerPersonBuckets } from "@/lib/trends";
import { dateDaysAgo } from "@/lib/dateUtils";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const [y, m, day] = s.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
}

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get("team") || "";

    if (!team) {
      return NextResponse.json({ error: "Missing team parameter" }, { status: 400 });
    }

    // Determine date range
    const rawStart = searchParams.get("startDate");
    const rawEnd = searchParams.get("endDate");
    let startDate: string;
    let endDate: string;

    if (rawStart && rawEnd && isValidISODate(rawStart) && isValidISODate(rawEnd)) {
      if (rawStart > rawEnd) {
        return NextResponse.json(
          { error: "startDate must be before or equal to endDate" },
          { status: 400 }
        );
      }
      const spanDays = (new Date(rawEnd + "T00:00:00Z").getTime() - new Date(rawStart + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24);
      if (spanDays > 90) {
        return NextResponse.json(
          { error: "Date range must not exceed 90 days" },
          { status: 400 }
        );
      }
      startDate = rawStart;
      endDate = rawEnd;
    } else {
      const parsedDays = parseInt(searchParams.get("days") ?? "", 10);
      const days = Math.min(Math.max(Number.isNaN(parsedDays) ? 14 : parsedDays, 1), 90);
      startDate = dateDaysAgo(days - 1);
      endDate = dateDaysAgo(0);
    }

    const from = new Date(startDate + "T00:00:00Z");

    const [members, allPRs] = await Promise.all([
      getTeamMembers(configOrError, team),
      getPullRequests(configOrError, from),
    ]);

    // Filter PRs to team members
    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );
    const teamPRs = allPRs.filter((pr) =>
      memberNameSet.has(pr.createdBy.uniqueName.toLowerCase())
    );

    const points = buildPerPersonBuckets(teamPRs, members, startDate, endDate);

    const memberList = members.map((m) => ({
      uniqueName: m.uniqueName,
      displayName: m.displayName,
    }));

    return NextResponse.json({ members: memberList, points });
  } catch (error) {
    return handleApiError(error);
  }
}

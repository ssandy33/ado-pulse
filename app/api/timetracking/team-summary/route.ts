import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { extractConfig, jsonWithCache, handleApiError, withLogging } from "@/lib/ado/helpers";
import { batchAsync } from "@/lib/ado/client";
import { getExclusions } from "@/lib/settings";
import { parseRange, resolveRange, countBusinessDays } from "@/lib/dateRange";
import {
  getSevenPaceConfig,
  getSevenPaceUsers,
  getWorklogsForUser,
  SevenPaceApiError,
} from "@/lib/sevenPace";
import { getWorkItems, resolveFeature } from "@/lib/ado/workItems";
import type {
  MemberTimeEntry,
  FeatureTimeBreakdown,
  WrongLevelEntry,
  TeamTimeData,
  GovernanceData,
  ExpenseType,
} from "@/lib/ado/types";

/**
 * Handle GET requests for a team's time-tracking summary and return aggregated metrics.
 *
 * Parses query parameters (range, team), queries SevenPace and ADO for worklogs and work items,
 * aggregates per-member and per-feature hours, computes governance/compliance metrics and diagnostics,
 * and returns a JSON response describing the team's time data.
 *
 * @returns `NextResponse` containing the team's aggregated time-tracking summary (`TeamTimeData`) on success, or a JSON error payload with an appropriate HTTP status when an error occurs.
 */
async function handler(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const range = parseRange(searchParams.get("range"));
    const { from, to, days, label } = resolveRange(range);
    const teamName = searchParams.get("team") || "";

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" }, 0);
    }

    // 1. Check 7pace config
    const spConfig = await getSevenPaceConfig();
    if (!spConfig) {
      return jsonWithCache({
        sevenPaceConnected: false,
        period: { days, from: from.toISOString(), to: to.toISOString(), label },
        team: { name: teamName, totalMembers: 0 },
        summary: {
          totalHours: 0, capExHours: 0, opExHours: 0,
          unclassifiedHours: 0, membersLogging: 0, membersNotLogging: 0,
          wrongLevelCount: 0,
        },
        members: [],
        wrongLevelEntries: [],
      } satisfies TeamTimeData);
    }

    // 2. Parallel fetch: team roster + 7pace user map (user map still used for diagnostics)
    const [members, spUsers] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getSevenPaceUsers(spConfig),
    ]);

    // 3. Load exclusions
    const exclusions = await getExclusions();
    const excludedMap = new Map(
      exclusions
        .filter((e) => e.excludeFromMetrics)
        .map((e) => [e.uniqueName.toLowerCase(), e.role])
    );

    // 4. Fetch worklogs per team member via OData API (real server-side user filtering)
    //    Each call filters by User/Email at the API level — no userId lookup needed.
    //    Concurrency of 5 to avoid overloading the 7pace API.
    const memberFetches = members.map((m) => {
      return async () => getWorklogsForUser(spConfig, m.uniqueName, from, to);
    });

    const memberResults = await batchAsync(memberFetches, 5);

    // Collect pagination diagnostics per member
    const paginationDetails = memberResults.map((r, idx) => ({
      uniqueName: members[idx]?.uniqueName ?? "unknown",
      pagesFetched: r.pagination?.pagesFetched ?? 1,
      hitCap: r.pagination?.hitSafetyCap ?? false,
    }));
    const anyMemberHitCap = paginationDetails.some((d) => d.hitCap);
    const totalPagesFetched = paginationDetails.reduce((s, d) => s + d.pagesFetched, 0);

    // Combine all per-member worklogs
    const teamWorklogs = memberResults.flatMap((r) => r.worklogs);
    const totalRawCount = memberResults.reduce((s, r) => s + r.rawCount, 0);

    // 5. Batch-fetch all unique workItemIds from ADO
    const allWorkItemIds = [...new Set(teamWorklogs.map((wl) => wl.workItemId).filter(Boolean))];
    const workItemCache = await getWorkItems(configOrError, allWorkItemIds);

    // 6. For each worklog, resolve feature + expense type
    const wrongLevelEntries: WrongLevelEntry[] = [];

    // Accumulate per-member data
    const memberMap = new Map<
      string,
      {
        displayName: string;
        uniqueName: string;
        totalHours: number;
        capExHours: number;
        opExHours: number;
        unclassifiedHours: number;
        wrongLevelHours: number;
        wrongLevelCount: number;
        isExcluded: boolean;
        role: string | null;
        featureMap: Map<string, FeatureTimeBreakdown>;
      }
    >();

    // Initialize all roster members
    for (const m of members) {
      const key = m.uniqueName.toLowerCase();
      const excRole = excludedMap.get(key);
      memberMap.set(key, {
        displayName: m.displayName,
        uniqueName: m.uniqueName,
        totalHours: 0,
        capExHours: 0,
        opExHours: 0,
        unclassifiedHours: 0,
        wrongLevelHours: 0,
        wrongLevelCount: 0,
        isExcluded: excRole !== undefined,
        role: excRole ?? null,
        featureMap: new Map(),
      });
    }

    // Process each worklog
    for (const wl of teamWorklogs) {
      const uniqueName = wl.uniqueName;
      if (!uniqueName) continue;

      const memberKey = uniqueName.toLowerCase();
      const member = memberMap.get(memberKey);
      if (!member) continue;

      let featureId: number | null = null;
      let featureTitle = "No Feature";
      let expenseType: ExpenseType = "Unclassified";
      let loggedAtWrongLevel = false;
      let originalWorkItemId: number | undefined;
      let originalWorkItemType: string | undefined;

      if (wl.workItemId) {
        const workItem = workItemCache.get(wl.workItemId);
        const wiType = workItem?.fields["System.WorkItemType"];

        if (wiType === "Feature") {
          // Logged on a Feature — correct level
          const rawExpense = workItem?.fields["Custom.FeatureExpense"];
          if (rawExpense === "CapEx" || rawExpense === "OpEx") {
            expenseType = rawExpense;
          }
          featureId = wl.workItemId;
          featureTitle = workItem?.fields["System.Title"] || `Feature ${wl.workItemId}`;
        } else {
          // Task/Story/Bug — wrong level, should be on the Feature
          loggedAtWrongLevel = true;
          originalWorkItemId = wl.workItemId;
          originalWorkItemType = wiType;
          const resolved = await resolveFeature(
            configOrError,
            wl.workItemId,
            workItemCache
          );
          featureId = resolved.featureId;
          featureTitle = resolved.featureTitle;
          expenseType = resolved.expenseType;
        }
      }

      // Accumulate hours
      member.totalHours += wl.hours;
      if (expenseType === "CapEx") member.capExHours += wl.hours;
      else if (expenseType === "OpEx") member.opExHours += wl.hours;
      else member.unclassifiedHours += wl.hours;

      if (loggedAtWrongLevel) {
        member.wrongLevelHours += wl.hours;
        member.wrongLevelCount++;
        wrongLevelEntries.push({
          workItemId: wl.workItemId,
          title: workItemCache.get(wl.workItemId)?.fields["System.Title"] || `Work item ${wl.workItemId}`,
          workItemType: originalWorkItemType || "Unknown",
          memberName: member.displayName,
          hours: wl.hours,
          resolvedFeatureId: featureId ?? undefined,
          resolvedFeatureTitle: featureId ? featureTitle : undefined,
        });
      }

      // Accumulate per-feature breakdown
      const featureKey = featureId !== null ? `${featureId}` : "none";
      const existing = member.featureMap.get(featureKey);
      if (existing) {
        existing.hours += wl.hours;
      } else {
        member.featureMap.set(featureKey, {
          featureId,
          featureTitle,
          expenseType,
          hours: wl.hours,
          loggedAtWrongLevel,
          originalWorkItemId,
          originalWorkItemType,
        });
      }
    }

    // 7. Build member entries
    const memberEntries: MemberTimeEntry[] = Array.from(memberMap.values()).map(
      (m) => ({
        displayName: m.displayName,
        uniqueName: m.uniqueName,
        totalHours: Math.round(m.totalHours * 100) / 100,
        capExHours: Math.round(m.capExHours * 100) / 100,
        opExHours: Math.round(m.opExHours * 100) / 100,
        unclassifiedHours: Math.round(m.unclassifiedHours * 100) / 100,
        wrongLevelHours: Math.round(m.wrongLevelHours * 100) / 100,
        wrongLevelCount: m.wrongLevelCount,
        isExcluded: m.isExcluded,
        role: m.role,
        features: Array.from(m.featureMap.values())
          .map((f) => ({
            ...f,
            hours: Math.round(f.hours * 100) / 100,
          }))
          .sort((a, b) => b.hours - a.hours),
      })
    );

    // 8. Sort: non-excluded with hours first (desc), then zero-hours, then excluded
    memberEntries.sort((a, b) => {
      if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1;
      return b.totalHours - a.totalHours;
    });

    const nonExcluded = memberEntries.filter((m) => !m.isExcluded);
    const membersLogging = nonExcluded.filter((m) => m.totalHours > 0).length;
    const membersNotLogging = nonExcluded.filter((m) => m.totalHours === 0).length;

    const totalHours = nonExcluded.reduce((s, m) => s + m.totalHours, 0);
    const capExHours = nonExcluded.reduce((s, m) => s + m.capExHours, 0);
    const opExHours = nonExcluded.reduce((s, m) => s + m.opExHours, 0);
    const unclassifiedHours = nonExcluded.reduce((s, m) => s + m.unclassifiedHours, 0);

    // Compute governance / compliance data
    const businessDays = countBusinessDays(from, to);
    const hoursPerDay = 8;
    const activeMembers = nonExcluded.length;
    const expectedHours = businessDays * hoursPerDay * activeMembers;
    const compliancePct = expectedHours > 0
      ? Math.round((totalHours / expectedHours) * 10000) / 100
      : 0;

    const governance: GovernanceData = {
      expectedHours,
      businessDays,
      hoursPerDay,
      activeMembers,
      compliancePct,
      isCompliant: compliancePct >= 95,
    };

    // Build diagnostics for debugging pipeline
    const spUsersList = Array.from(spUsers.entries()).map(([id, name]) => ({ id, uniqueName: name }));
    const rosterList = members.map((m) => m.uniqueName.toLowerCase());

    const response: TeamTimeData = {
      period: { days, from: from.toISOString(), to: to.toISOString(), label },
      team: { name: teamName, totalMembers: nonExcluded.length },
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        capExHours: Math.round(capExHours * 100) / 100,
        opExHours: Math.round(opExHours * 100) / 100,
        unclassifiedHours: Math.round(unclassifiedHours * 100) / 100,
        membersLogging,
        membersNotLogging,
        wrongLevelCount: wrongLevelEntries.length,
      },
      members: memberEntries,
      wrongLevelEntries,
      sevenPaceConnected: true,
      governance,
      diagnostics: {
        sevenPaceUsersTotal: spUsers.size,
        sevenPaceUsers: spUsersList.slice(0, 20),
        fetchMode: "per-member-odata",
        fetchApi: "odata",
        membersFetched: memberResults.length,
        membersWithNoSpId: [],
        totalWorklogsFromSevenPace: totalRawCount,
        worklogsMatchedToTeam: teamWorklogs.length,
        rosterUniqueNames: rosterList,
        sampleWorklogs: teamWorklogs.slice(0, 5).map((wl) => ({
          userId: wl.userId,
          resolvedUniqueName: wl.uniqueName || null,
          workItemId: wl.workItemId,
          hours: wl.hours,
        })),
        pagination: {
          totalPagesFetched: totalPagesFetched,
          totalRecordsFetched: totalRawCount,
          anyMemberHitCap,
        },
      },
    };

    return jsonWithCache(response, 120);
  } catch (error) {
    if (error instanceof SevenPaceApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 401 : 502 }
      );
    }
    return handleApiError(error);
  }
}

export const GET = withLogging("timetracking/team-summary", handler);
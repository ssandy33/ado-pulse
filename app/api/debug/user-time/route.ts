import { NextRequest, NextResponse } from "next/server";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import {
  getSevenPaceConfig,
  sevenPaceFetch,
} from "@/lib/sevenPace";
import { getWorkItems } from "@/lib/ado/workItems";

interface RawWorklogUser {
  id: string;
  uniqueName?: string;
  name?: string;
}

interface RawWorklog {
  id: string;
  user?: RawWorklogUser;
  workItemId?: number | null;
  length: number;
  timestamp: string;
  activityType?: { name?: string } | null;
  [key: string]: unknown;
}

interface SevenPaceUser {
  id: string;
  email?: string;
  uniqueName?: string;
  displayName?: string;
}

interface SevenPaceUsersResponse {
  data: SevenPaceUser[];
}

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Missing email parameter" },
      { status: 400 }
    );
  }

  try {
    // 1. Check 7pace config
    const spConfig = await getSevenPaceConfig();
    if (!spConfig) {
      return NextResponse.json(
        { error: "7pace not configured" },
        { status: 400 }
      );
    }

    // 2. Fetch all 7pace users and find matching user
    const usersResult = await sevenPaceFetch<SevenPaceUsersResponse>(
      spConfig,
      "users",
      { "api-version": "3.2" }
    );

    const allUsers = usersResult.data ?? [];
    const matchedUser = allUsers.find((u) => {
      const uEmail = (u.email || "").toLowerCase();
      const uUnique = (u.uniqueName || "").toLowerCase();
      return uEmail === email || uUnique === email;
    });

    if (!matchedUser) {
      return NextResponse.json({
        user: null,
        error: `No 7pace user found matching "${email}"`,
        availableUsers: allUsers
          .map((u) => ({
            id: u.id,
            email: u.email || u.uniqueName || "",
            displayName: u.displayName || "",
          }))
          .filter((u) => u.email)
          .slice(0, 20),
      });
    }

    // 3. Fetch 30-day worklogs from 7pace
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const toDateStr = (d: Date) => d.toISOString().split(".")[0];

    const result = await sevenPaceFetch<Record<string, unknown>>(
      spConfig,
      "workLogs/all",
      {
        "api-version": "3.2",
        _fromTimestamp: toDateStr(thirtyDaysAgo),
        _toTimestamp: toDateStr(now),
        _count: "2000",
      }
    );

    // Parse response (try common shapes)
    let allWorklogs: RawWorklog[] = [];
    if (Array.isArray(result.data)) {
      allWorklogs = result.data;
    } else if (Array.isArray(result.value)) {
      allWorklogs = result.value as RawWorklog[];
    } else if (Array.isArray(result)) {
      allWorklogs = result as unknown as RawWorklog[];
    }

    // 4. Filter to this user's worklogs
    const userWorklogs = allWorklogs.filter(
      (wl) => wl.user?.id === matchedUser.id
    );

    // 5. Collect unique work item IDs and batch fetch details
    const workItemIds = [
      ...new Set(
        userWorklogs
          .map((wl) => wl.workItemId)
          .filter((id): id is number => id != null && id > 0)
      ),
    ];

    const workItemMap = await getWorkItems(configOrError, workItemIds);

    // 6. Aggregate worklogs by work item
    const byWorkItem = new Map<
      number,
      {
        workItemId: number;
        title: string;
        type: string;
        totalHours: number;
        entryCount: number;
        activities: Set<string>;
        entries: {
          id: string;
          date: string;
          hours: number;
          activity: string;
        }[];
      }
    >();

    for (const wl of userWorklogs) {
      const wiId = wl.workItemId ?? 0;
      const hours = Math.round((wl.length / 3600) * 100) / 100;
      const activity = wl.activityType?.name || "Unknown";

      if (!byWorkItem.has(wiId)) {
        const wi = workItemMap.get(wiId);
        byWorkItem.set(wiId, {
          workItemId: wiId,
          title: wi?.fields["System.Title"] || (wiId === 0 ? "No Work Item" : `Work Item #${wiId}`),
          type: wi?.fields["System.WorkItemType"] || "Unknown",
          totalHours: 0,
          entryCount: 0,
          activities: new Set(),
          entries: [],
        });
      }

      const agg = byWorkItem.get(wiId)!;
      agg.totalHours += hours;
      agg.entryCount += 1;
      agg.activities.add(activity);
      agg.entries.push({
        id: wl.id,
        date: wl.timestamp,
        hours,
        activity,
      });
    }

    // Sort entries within each work item by date descending
    const workItems = [...byWorkItem.values()]
      .map((wi) => ({
        workItemId: wi.workItemId,
        title: wi.title,
        type: wi.type,
        totalHours: Math.round(wi.totalHours * 100) / 100,
        entryCount: wi.entryCount,
        activities: [...wi.activities],
        entries: wi.entries.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // 7. Build summary
    const totalHours = workItems.reduce((s, w) => s + w.totalHours, 0);
    const allDates = userWorklogs.map((w) => w.timestamp).filter(Boolean);
    allDates.sort();

    const response = {
      user: {
        id: matchedUser.id,
        email: matchedUser.email || matchedUser.uniqueName || email,
        displayName: matchedUser.displayName || "",
      },
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        workItemCount: workItems.filter((w) => w.workItemId !== 0).length,
        entryCount: userWorklogs.length,
        dateRange:
          allDates.length > 0
            ? { earliest: allDates[0], latest: allDates[allDates.length - 1] }
            : null,
        period: {
          from: toDateStr(thirtyDaysAgo),
          to: toDateStr(now),
          days: 30,
        },
      },
      workItems,
    };

    return jsonWithCache(response, 60);
  } catch (error) {
    return handleApiError(error);
  }
}

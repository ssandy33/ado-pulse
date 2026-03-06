import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { aggregateWeeklyPRTrends, aggregateDailyPRTrends } from "@/lib/trends";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get("team") || "";
    const granularity = searchParams.get("granularity") || "daily";

    if (!team) {
      return NextResponse.json({ error: "Missing team parameter" }, { status: 400 });
    }

    if (granularity === "weekly") {
      const parsedWeeks = parseInt(searchParams.get("weeks") ?? "", 10);
      const weeks = Math.min(Math.max(Number.isNaN(parsedWeeks) ? 4 : parsedWeeks, 1), 12);

      const weeklyData = aggregateWeeklyPRTrends(
        configOrError.org,
        configOrError.project,
        team,
        weeks
      );

      return NextResponse.json({
        weeks: weeklyData,
        points: weeklyData,
        granularity: "weekly",
        hasEnoughData: weeklyData.length >= 3,
        data_source: "cache",
      });
    }

    // Default: daily — support explicit date range or trailing-day window
    const rawStart = searchParams.get("startDate");
    const rawEnd = searchParams.get("endDate");
    const hasDateRange = rawStart && rawEnd && isValidISODate(rawStart) && isValidISODate(rawEnd);

    const parsedDays = parseInt(searchParams.get("days") ?? "", 10);
    const days = Math.min(Math.max(Number.isNaN(parsedDays) ? 14 : parsedDays, 1), 90);

    const dailyData = aggregateDailyPRTrends(
      configOrError.org,
      configOrError.project,
      team,
      days,
      hasDateRange ? { startDate: rawStart, endDate: rawEnd } : undefined
    );

    return NextResponse.json({
      points: dailyData,
      granularity: "daily",
      hasEnoughData: dailyData.length >= 3,
      data_source: "cache",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

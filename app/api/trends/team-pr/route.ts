import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { aggregateWeeklyPRTrends, aggregateDailyPRTrends } from "@/lib/trends";

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

    // Default: daily
    const parsedDays = parseInt(searchParams.get("days") ?? "", 10);
    const days = Math.min(Math.max(Number.isNaN(parsedDays) ? 14 : parsedDays, 1), 90);

    const dailyData = aggregateDailyPRTrends(
      configOrError.org,
      configOrError.project,
      team,
      days
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

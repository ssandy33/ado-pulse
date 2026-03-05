import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { aggregateWeeklyPRTrends } from "@/lib/trends";

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get("team") || "";
    const weeks = Math.min(parseInt(searchParams.get("weeks") || "4", 10) || 4, 12);

    if (!team) {
      return NextResponse.json({ error: "Missing team parameter" }, { status: 400 });
    }

    const weeklyData = aggregateWeeklyPRTrends(
      configOrError.org,
      configOrError.project,
      team,
      weeks
    );

    return NextResponse.json({
      weeks: weeklyData,
      hasEnoughData: weeklyData.length >= 3,
      data_source: "cache",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

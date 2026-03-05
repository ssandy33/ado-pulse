import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { aggregateWeeklyHoursTrends } from "@/lib/trends";

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const weeks = Math.min(
      parseInt(request.nextUrl.searchParams.get("weeks") || "4", 10) || 4,
      12
    );

    const weeklyData = aggregateWeeklyHoursTrends(configOrError.org, weeks);

    return NextResponse.json({
      weeks: weeklyData,
      hasEnoughData: weeklyData.length >= 3,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { extractConfig, handleApiError } from "@/lib/ado/helpers";
import { aggregateSprintComparison } from "@/lib/trends";

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get("team") || "";
    const sprintDays =
      Math.min(parseInt(searchParams.get("sprintLengthDays") || "14", 10) || 14, 30);

    if (!team) {
      return NextResponse.json({ error: "Missing team parameter" }, { status: 400 });
    }

    const comparison = aggregateSprintComparison(
      configOrError.org,
      configOrError.project,
      team,
      sprintDays
    );

    if (!comparison) {
      return NextResponse.json(
        { error: "insufficient_data", message: "Not enough snapshot data for sprint comparison" },
        { status: 200 }
      );
    }

    return NextResponse.json(comparison);
  } catch (error) {
    return handleApiError(error);
  }
}

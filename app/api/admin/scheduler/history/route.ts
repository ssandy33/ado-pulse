import { NextResponse } from "next/server";
import { getSchedulerHistory, getLastSchedulerRun } from "@/lib/schedulerLog";

export async function GET() {
  try {
    const runs = getSchedulerHistory(30);
    const lastRun = getLastSchedulerRun();
    return NextResponse.json({ runs, lastRun });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch scheduler history" },
      { status: 500 }
    );
  }
}

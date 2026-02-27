import { NextRequest, NextResponse } from "next/server";
import { getTeamSnapshots, getTimeSnapshots } from "@/lib/snapshots";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "snapshots", method: "GET" });

  try {
    const params = request.nextUrl.searchParams;
    const org = params.get("org") || request.headers.get("x-ado-org");
    const project = params.get("project") || request.headers.get("x-ado-project");
    const type = params.get("type") || "pr";
    const team = params.get("team");
    const rawDays = parseInt(params.get("days") ?? "30", 10);
    const days = Math.min(Math.max(Number.isNaN(rawDays) ? 30 : rawDays, 1), 365);

    if (!org || !project) {
      return NextResponse.json(
        { error: "Missing required params: org, project (query string or x-ado-* headers)" },
        { status: 400 }
      );
    }

    if (type === "time") {
      const snapshots = getTimeSnapshots(org, days);
      logger.info("Request complete", {
        route: "snapshots",
        method: "GET",
        type,
        count: snapshots.length,
        durationMs: Date.now() - start,
      });
      return NextResponse.json({ type: "time", count: snapshots.length, snapshots });
    }

    const snapshots = getTeamSnapshots(org, project, team || null, days);
    logger.info("Request complete", {
      route: "snapshots",
      method: "GET",
      type: "pr",
      count: snapshots.length,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({ type: "pr", count: snapshots.length, snapshots });
  } catch (err) {
    logger.error("Snapshot read failed", {
      route: "snapshots",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

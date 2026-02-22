import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/team-visibility", method: "GET" });
  const settings = await readSettings();
  logger.info("Request complete", { route: "settings/team-visibility", method: "GET", durationMs: Date.now() - start });
  return NextResponse.json(settings.teamVisibility ?? { pinnedTeams: [] });
}

export async function PUT(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/team-visibility", method: "PUT" });
  try {
    const body = await request.json();
    const pinnedTeams: string[] = Array.isArray(body.pinnedTeams)
      ? body.pinnedTeams.filter((t: unknown) => typeof t === "string")
      : [];

    const settings = await readSettings();
    settings.teamVisibility = { pinnedTeams };
    await writeSettings(settings);

    logger.info("Request complete", { route: "settings/team-visibility", method: "PUT", durationMs: Date.now() - start });
    return NextResponse.json(settings.teamVisibility);
  } catch (error) {
    logger.error("Request error", { route: "settings/team-visibility", method: "PUT", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

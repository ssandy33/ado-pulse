import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";
import type { MemberRoleExclusion } from "@/lib/ado/types";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/member-roles", method: "GET" });
  const settings = await readSettings();
  logger.info("Request complete", { route: "settings/member-roles", method: "GET", durationMs: Date.now() - start });
  return NextResponse.json(settings.memberRoles ?? { exclusions: [] });
}

export async function PUT(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/member-roles", method: "PUT" });
  try {
    const body = await request.json();
    const exclusions: MemberRoleExclusion[] = (body.exclusions ?? []).map(
      (e: MemberRoleExclusion) => ({
        uniqueName: e.uniqueName,
        displayName: e.displayName,
        role: e.role || "",
        excludeFromMetrics: e.excludeFromMetrics,
        addedAt: e.addedAt || new Date().toISOString(),
      })
    );

    const settings = await readSettings();
    settings.memberRoles = { exclusions };
    await writeSettings(settings);

    logger.info("Request complete", { route: "settings/member-roles", method: "PUT", durationMs: Date.now() - start });
    return NextResponse.json(settings.memberRoles);
  } catch (error) {
    logger.error("Request error", { route: "settings/member-roles", method: "PUT", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

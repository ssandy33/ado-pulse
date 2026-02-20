import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import type { MemberRoleExclusion } from "@/lib/ado/types";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings.memberRoles ?? { exclusions: [] });
}

export async function PUT(request: NextRequest) {
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

    return NextResponse.json(settings.memberRoles);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

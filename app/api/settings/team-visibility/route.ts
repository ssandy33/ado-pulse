import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings.teamVisibility ?? { pinnedTeams: [] });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const pinnedTeams: string[] = Array.isArray(body.pinnedTeams)
      ? body.pinnedTeams.filter((t: unknown) => typeof t === "string")
      : [];

    const settings = await readSettings();
    settings.teamVisibility = { pinnedTeams };
    await writeSettings(settings);

    return NextResponse.json(settings.teamVisibility);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

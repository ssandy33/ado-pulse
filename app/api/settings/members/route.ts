import { NextRequest, NextResponse } from "next/server";
import { getMemberProfiles, upsertMemberProfile } from "@/lib/settings";
import { logger } from "@/lib/logger";
import type { MemberProfile } from "@/lib/ado/types";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/members", method: "GET" });
  try {
    const profiles = await getMemberProfiles();
    logger.info("Request complete", { route: "settings/members", method: "GET", durationMs: Date.now() - start });
    return NextResponse.json({ profiles });
  } catch (error) {
    logger.error("Request error", { route: "settings/members", method: "GET", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Failed to read member profiles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/members", method: "POST" });
  try {
    const body = (await request.json()) as MemberProfile;

    if (!body.adoId || !body.agency || !body.employmentType) {
      return NextResponse.json(
        { error: "adoId, agency, employmentType required" },
        { status: 400 },
      );
    }

    await upsertMemberProfile({
      adoId: body.adoId,
      displayName: body.displayName || "",
      email: body.email || "",
      employmentType: body.employmentType,
      agency: body.agency,
    });

    logger.info("Request complete", { route: "settings/members", method: "POST", durationMs: Date.now() - start });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Request error", { route: "settings/members", method: "POST", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

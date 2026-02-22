import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings", method: "GET" });
  const settings = await readSettings();
  logger.info("Request complete", { route: "settings", method: "GET", durationMs: Date.now() - start });
  return NextResponse.json(settings);
}

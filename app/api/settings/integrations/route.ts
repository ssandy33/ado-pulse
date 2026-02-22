import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations", method: "GET" });
  try {
    const settings = await readSettings();
    const sp = settings.integrations?.sevenPace;

    // Mask the token — only return last 4 chars
    const masked = sp
      ? {
          apiToken: sp.apiToken
            ? `${"*".repeat(Math.max(0, sp.apiToken.length - 4))}${sp.apiToken.slice(-4)}`
            : "",
          baseUrl: sp.baseUrl || "",
        }
      : null;

    logger.info("Request complete", { route: "settings/integrations", method: "GET", durationMs: Date.now() - start });
    return NextResponse.json({ sevenPace: masked });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations", method: "GET", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations", method: "PUT" });
  try {
    const body = await request.json();
    const { sevenPace } = body;

    if (!sevenPace || typeof sevenPace !== "object") {
      return NextResponse.json(
        { error: "Invalid body: expected { sevenPace: { apiToken, baseUrl } }" },
        { status: 400 }
      );
    }

    const { apiToken, baseUrl } = sevenPace;

    if (typeof apiToken !== "string" || typeof baseUrl !== "string") {
      return NextResponse.json(
        { error: "apiToken and baseUrl must be strings" },
        { status: 400 }
      );
    }

    const settings = await readSettings();
    settings.integrations = {
      ...settings.integrations,
      sevenPace: { apiToken, baseUrl },
    };
    await writeSettings(settings);

    // Return masked token
    const masked = {
      apiToken: apiToken
        ? `${"*".repeat(Math.max(0, apiToken.length - 4))}${apiToken.slice(-4)}`
        : "",
      baseUrl,
    };

    logger.info("Request complete", { route: "settings/integrations", method: "PUT", durationMs: Date.now() - start });
    return NextResponse.json({ sevenPace: masked });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations", method: "PUT", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

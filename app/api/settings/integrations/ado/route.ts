import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations/ado", method: "GET" });
  try {
    const settings = await readSettings();
    const ado = settings.integrations?.ado;

    if (ado?.pat) {
      logger.info("Request complete", { route: "settings/integrations/ado", method: "GET", durationMs: Date.now() - start });
      return NextResponse.json({
        configured: true,
        source: "settings",
        orgUrl: ado.orgUrl || "",
      });
    }

    if (process.env.ADO_PAT) {
      logger.info("Request complete", { route: "settings/integrations/ado", method: "GET", durationMs: Date.now() - start });
      return NextResponse.json({ configured: true, source: "env", orgUrl: "" });
    }

    logger.info("Request complete", { route: "settings/integrations/ado", method: "GET", durationMs: Date.now() - start });
    return NextResponse.json({ configured: false, source: "none", orgUrl: "" });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations/ado", method: "GET", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { error: "Failed to read settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations/ado", method: "PUT" });
  try {
    const body = await request.json();
    const { pat, org, orgUrl } = body;

    if (typeof pat !== "string" || !pat.trim()) {
      logger.info("Request complete", { route: "settings/integrations/ado", method: "PUT", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        { success: false, error: "PAT is required" },
        { status: 400 }
      );
    }

    if (typeof org !== "string" || !org.trim()) {
      logger.info("Request complete", { route: "settings/integrations/ado", method: "PUT", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        { success: false, error: "Organization is required" },
        { status: 400 }
      );
    }

    // Validate PAT by hitting the ADO projects API
    const testRes = await fetch(
      `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects?api-version=7.0`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
        },
      }
    );

    const contentType = testRes.headers.get("content-type") || "";
    if (!testRes.ok || !contentType.includes("application/json")) {
      logger.info("Request complete", { route: "settings/integrations/ado", method: "PUT", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        {
          success: false,
          error:
            testRes.status === 401 || testRes.status === 403
              ? "Invalid PAT or insufficient permissions"
              : `ADO API returned ${testRes.status}`,
        },
        { status: 400 }
      );
    }

    // Save to settings
    const settings = await readSettings();
    settings.integrations = {
      ...settings.integrations,
      ado: { pat, orgUrl: orgUrl || "" },
    };
    await writeSettings(settings);

    logger.info("Request complete", { route: "settings/integrations/ado", method: "PUT", durationMs: Date.now() - start });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations/ado", method: "PUT", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { success: false, error: "Failed to save PAT" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations/ado", method: "DELETE" });
  try {
    const settings = await readSettings();

    if (settings.integrations?.ado) {
      delete settings.integrations.ado;
      await writeSettings(settings);
    }

    logger.info("Request complete", { route: "settings/integrations/ado", method: "DELETE", durationMs: Date.now() - start });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations/ado", method: "DELETE", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { success: false, error: "Failed to remove PAT" },
      { status: 500 }
    );
  }
}

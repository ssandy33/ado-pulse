import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const start = Date.now();
  logger.info("Request start", { route: "settings/integrations/ado/test", method: "POST" });
  try {
    const body = await request.json();
    const { pat, org } = body;

    if (typeof pat !== "string" || !pat.trim()) {
      logger.info("Request complete", { route: "settings/integrations/ado/test", method: "POST", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        { success: false, error: "PAT is required" },
        { status: 400 }
      );
    }

    if (typeof org !== "string" || !org.trim()) {
      logger.info("Request complete", { route: "settings/integrations/ado/test", method: "POST", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        { success: false, error: "Organization is required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects?api-version=7.0`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
        },
      }
    );

    if (!res.ok) {
      const errorMsg =
        res.status === 401 || res.status === 403
          ? "Invalid PAT or insufficient permissions"
          : `ADO API returned ${res.status}`;
      logger.info("Request complete", { route: "settings/integrations/ado/test", method: "POST", durationMs: Date.now() - start, status: res.status });
      return NextResponse.json({ success: false, error: errorMsg }, { status: res.status });
    }

    logger.info("Request complete", { route: "settings/integrations/ado/test", method: "POST", durationMs: Date.now() - start });
    return NextResponse.json({ success: true, orgName: org });
  } catch (error) {
    logger.error("Request error", { route: "settings/integrations/ado/test", method: "POST", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { success: false, error: "Connection test failed" },
      { status: 500 }
    );
  }
}

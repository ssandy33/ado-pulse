import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await readSettings();
    const ado = settings.integrations?.ado;

    if (ado?.pat) {
      return NextResponse.json({
        configured: true,
        source: "settings",
        orgUrl: ado.orgUrl || "",
      });
    }

    if (process.env.ADO_PAT) {
      return NextResponse.json({ configured: true, source: "env", orgUrl: "" });
    }

    return NextResponse.json({ configured: false, source: "none", orgUrl: "" });
  } catch {
    return NextResponse.json(
      { error: "Failed to read settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pat, org, orgUrl } = body;

    if (typeof pat !== "string" || !pat.trim()) {
      return NextResponse.json(
        { success: false, error: "PAT is required" },
        { status: 400 }
      );
    }

    if (typeof org !== "string" || !org.trim()) {
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

    if (!testRes.ok) {
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

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save PAT" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const settings = await readSettings();

    if (settings.integrations?.ado) {
      delete settings.integrations.ado;
      await writeSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to remove PAT" },
      { status: 500 }
    );
  }
}

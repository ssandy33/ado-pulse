import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pat, org } = body;

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
      return NextResponse.json({ success: false, error: errorMsg });
    }

    return NextResponse.json({ success: true, orgName: org });
  } catch {
    return NextResponse.json(
      { success: false, error: "Connection test failed" },
      { status: 500 }
    );
  }
}

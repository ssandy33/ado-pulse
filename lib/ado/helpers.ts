import { NextRequest, NextResponse } from "next/server";
import { AdoApiError } from "./client";
import type { AdoConfig } from "./types";
import { readSettings } from "@/lib/settings";

export async function extractConfig(
  request: NextRequest
): Promise<AdoConfig | NextResponse> {
  const org = request.headers.get("x-ado-org");
  const project = request.headers.get("x-ado-project");
  let pat = request.headers.get("x-ado-pat") || "";

  // Fall back to saved PAT, then env var
  if (!pat) {
    const settings = await readSettings();
    pat = settings.integrations?.ado?.pat || process.env.ADO_PAT || "";
  }

  if (!org || !project || !pat) {
    return NextResponse.json(
      { error: "Missing x-ado-org, x-ado-project, or x-ado-pat headers" },
      { status: 401 }
    );
  }

  return { org, project, pat };
}

export function jsonWithCache<T>(data: T, cacheSecs = 300): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${cacheSecs}, stale-while-revalidate=${cacheSecs}`,
    },
  });
}

export function handleApiError(error: unknown): NextResponse {
  // Use name check as fallback for instanceof failures in bundled output
  const adoErr =
    error instanceof AdoApiError
      ? error
      : error instanceof Error &&
          error.name === "AdoApiError" &&
          "status" in error
        ? (error as AdoApiError)
        : null;

  if (adoErr) {
    return NextResponse.json(
      { error: adoErr.message, status: adoErr.status },
      { status: adoErr.status }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  return NextResponse.json({ error: message }, { status: 500 });
}

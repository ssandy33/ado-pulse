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

/** Coerce an unknown error to AdoApiError if it matches the shape.
 *  Handles instanceof failures from Next.js standalone bundling. */
export function coerceAdoApiError(error: unknown): AdoApiError | null {
  if (error instanceof AdoApiError) return error;
  if (
    error instanceof Error &&
    error.name === "AdoApiError" &&
    typeof (error as unknown as Record<string, unknown>).status === "number" &&
    typeof (error as unknown as Record<string, unknown>).url === "string"
  ) {
    return error as AdoApiError;
  }
  return null;
}

export function handleApiError(error: unknown): NextResponse {
  const adoErr = coerceAdoApiError(error);

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

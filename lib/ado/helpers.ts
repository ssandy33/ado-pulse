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

/**
 * Create a JSON response that includes shared caching headers for s-maxage and stale-while-revalidate.
 *
 * @param data - The value to serialize as the JSON response body
 * @param cacheSecs - Number of seconds to use for `s-maxage` and `stale-while-revalidate` (default 300)
 * @returns A NextResponse whose body is the JSON-serialized `data` and that includes a `Cache-Control` header set to `public, s-maxage=<cacheSecs>, stale-while-revalidate=<cacheSecs>`
 */
export function jsonWithCache<T>(data: T, cacheSecs = 300): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${cacheSecs}, stale-while-revalidate=${cacheSecs}`,
    },
  });
}

/**
 * Attempts to convert an unknown value into an AdoApiError when it matches the AdoApiError shape.
 *
 * @param error - The value to inspect and coerce; typically an Error or an object that may have `name`, `status`, and `url` properties.
 * @returns An `AdoApiError` if `error` is already an instance or has the AdoApiError shape (`name === "AdoApiError"`, numeric `status`, string `url`), `null` otherwise.
 */
export function coerceAdoApiError(error: unknown): AdoApiError | null {
  if (error instanceof AdoApiError) return error;
  if (
    error instanceof Error &&
    error.name === "AdoApiError" &&
    typeof (error as Record<string, unknown>).status === "number" &&
    typeof (error as Record<string, unknown>).url === "string"
  ) {
    return error as AdoApiError;
  }
  return null;
}

/**
 * Create a NextResponse containing an API error payload and the corresponding HTTP status.
 *
 * @param error - The caught error value; if it matches the AdoApiError shape its `message` and `status` are used.
 * @returns A NextResponse with a JSON body. If `error` is an AdoApiError the body is `{ error: <message>, status: <status> }` and the response status is `<status>`; otherwise the body is `{ error: <message> }` and the response status is `500`.
 */
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
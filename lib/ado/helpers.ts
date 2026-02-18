import { NextRequest, NextResponse } from "next/server";
import { AdoApiError } from "./client";
import type { AdoConfig } from "./types";

export function extractConfig(
  request: NextRequest
): AdoConfig | NextResponse {
  const org = request.headers.get("x-ado-org");
  const project = request.headers.get("x-ado-project");
  const pat = request.headers.get("x-ado-pat");

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
  if (error instanceof AdoApiError) {
    return NextResponse.json(
      { error: error.message, status: error.status },
      { status: error.status }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  return NextResponse.json({ error: message }, { status: 500 });
}

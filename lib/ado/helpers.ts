import { NextResponse } from "next/server";
import { AdoApiError } from "./client";

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

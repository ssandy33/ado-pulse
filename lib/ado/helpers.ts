import { NextRequest, NextResponse } from "next/server";
import { AdoApiError } from "./client";
import type { AdoConfig } from "./types";
import { readSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

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
    logger.error("ADO API error", {
      status: adoErr.status,
      url: adoErr.url,
      errorMessage: adoErr.message,
    });
    return NextResponse.json(
      { error: adoErr.message, status: adoErr.status },
      { status: adoErr.status }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  logger.error("Unhandled API error", {
    errorMessage: message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return NextResponse.json({ error: message }, { status: 500 });
}

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

export function withLogging(routeName: string, handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    const start = Date.now();
    logger.info("Request start", { route: routeName, method: request.method });

    try {
      const response = await handler(request);
      const durationMs = Date.now() - start;
      logger.info("Request end", {
        route: routeName,
        method: request.method,
        status: response.status,
        durationMs,
      });
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      logger.error("Request error", {
        route: routeName,
        method: request.method,
        durationMs,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

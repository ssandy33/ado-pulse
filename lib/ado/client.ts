import type { AdoConfig } from "./types";

export class AdoApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public url: string
  ) {
    super(message);
    this.name = "AdoApiError";
  }
}

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(":" + pat).toString("base64")}`;
}

export function orgUrl(config: AdoConfig, path: string): string {
  return `https://dev.azure.com/${config.org}/${path}`;
}

export function projectUrl(config: AdoConfig, path: string): string {
  return `https://dev.azure.com/${config.org}/${config.project}/${path}`;
}

// ── In-memory TTL cache with request coalescing ──

interface CacheEntry {
  promise: Promise<unknown>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const fetchCache = new Map<string, CacheEntry>();

async function _adoFetchRaw<T>(config: AdoConfig, url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader(config.pat),
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new AdoApiError(
        `ADO API error: ${res.status} ${res.statusText}`,
        res.status,
        url
      );
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AdoApiError("ADO API request timed out", 504, url);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function adoFetch<T>(config: AdoConfig, url: string): Promise<T> {
  const now = Date.now();
  const cached = fetchCache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  const promise = _adoFetchRaw<T>(config, url);

  fetchCache.set(url, { promise, expiresAt: now + CACHE_TTL_MS });

  // Remove from cache on rejection so errors aren't served stale
  promise.catch(() => {
    fetchCache.delete(url);
  });

  return promise;
}

/** Run async tasks in batches to avoid overwhelming ADO API */
export async function batchAsync<T>(
  tasks: (() => Promise<T>)[],
  concurrency = 5
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

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

export async function adoFetch<T>(config: AdoConfig, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(config.pat),
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new AdoApiError(
      `ADO API error: ${res.status} ${res.statusText}`,
      res.status,
      url
    );
  }

  return res.json() as Promise<T>;
}

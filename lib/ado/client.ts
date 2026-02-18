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

function getConfig() {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const pat = process.env.ADO_PAT;

  if (!org || !project || !pat) {
    throw new Error(
      "Missing required environment variables: ADO_ORG, ADO_PROJECT, ADO_PAT"
    );
  }

  return { org, project, pat };
}

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(":" + pat).toString("base64")}`;
}

export function orgUrl(path: string): string {
  const { org } = getConfig();
  return `https://dev.azure.com/${org}/${path}`;
}

export function projectUrl(path: string): string {
  const { org, project } = getConfig();
  return `https://dev.azure.com/${org}/${project}/${path}`;
}

export async function adoFetch<T>(url: string): Promise<T> {
  const { pat } = getConfig();

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
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

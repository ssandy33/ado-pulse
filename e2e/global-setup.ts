import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  const token = process.env.AXIOM_API_TOKEN;
  if (!token) return;

  const startTime = new Date().toISOString();
  process.env._E2E_START_TIME = startTime;

  console.log(`[e2e] Suite started at ${startTime}`);
}

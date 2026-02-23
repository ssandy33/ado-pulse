import type { FullConfig } from "@playwright/test";

export default async function globalTeardown(_config: FullConfig) {
  const token = process.env.AXIOM_API_TOKEN;
  if (!token) return;

  const startTime = process.env._E2E_START_TIME;
  const endTime = new Date().toISOString();

  const payload = [
    {
      _time: endTime,
      event: "e2e_suite_complete",
      startTime,
      endTime,
      ci: !!process.env.CI,
    },
  ];

  try {
    const dataset = process.env.AXIOM_DATASET || "ado-pulse-e2e";
    await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    console.log(`[e2e] Suite result sent to Axiom (${dataset})`);
  } catch (err) {
    console.warn("[e2e] Failed to send results to Axiom:", err);
  }
}

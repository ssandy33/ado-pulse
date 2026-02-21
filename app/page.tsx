"use client";

import { useState, useEffect } from "react";
import { ConnectionForm } from "@/components/ConnectionForm";
import { Dashboard } from "@/components/Dashboard";

function parseOrgUrl(input: string): { org: string; project: string } | null {
  const cleaned = input.trim().replace(/\/+$/, "");
  const urlMatch = cleaned.match(/dev\.azure\.com\/([^/]+)\/([^/]+)/);
  if (urlMatch) return { org: urlMatch[1], project: urlMatch[2] };
  const plainMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (plainMatch) return { org: plainMatch[1], project: plainMatch[2] };
  return null;
}

export default function Home() {
  const [creds, setCreds] = useState<{
    org: string;
    project: string;
    pat: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  // On mount, check for a saved connection
  useEffect(() => {
    fetch("/api/settings/integrations/ado")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.configured && data.source === "settings" && data.orgUrl) {
          const parsed = parseOrgUrl(data.orgUrl);
          if (parsed) {
            // Verify the saved connection still works (server uses saved PAT)
            const testRes = await fetch("/api/teams", {
              headers: {
                "x-ado-org": parsed.org,
                "x-ado-project": parsed.project,
              },
            });
            if (testRes.ok) {
              setCreds({ org: parsed.org, project: parsed.project, pat: "" });
              return;
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-pulse-bg flex items-center justify-center">
        <div className="text-pulse-muted text-sm">Connecting...</div>
      </div>
    );
  }

  if (!creds) {
    return <ConnectionForm onConnect={setCreds} />;
  }

  return <Dashboard creds={creds} onDisconnect={() => setCreds(null)} />;
}

"use client";

import { useState, useEffect } from "react";
import { ConnectionForm, STORAGE_KEYS, parseOrgUrl } from "@/components/ConnectionForm";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [creds, setCreds] = useState<{
    org: string;
    project: string;
    pat: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  // On mount, check localStorage for saved credentials
  useEffect(() => {
    let orgUrl: string | null;
    let pat: string | null;
    try {
      orgUrl = localStorage.getItem(STORAGE_KEYS.ORG_URL);
      pat = localStorage.getItem(STORAGE_KEYS.PAT);
    } catch {
      setChecking(false);
      return;
    }

    if (!orgUrl || !pat) {
      setChecking(false);
      return;
    }

    const parsed = parseOrgUrl(orgUrl);
    if (!parsed) {
      try {
        localStorage.removeItem(STORAGE_KEYS.ORG_URL);
        localStorage.removeItem(STORAGE_KEYS.PAT);
      } catch {}
      setChecking(false);
      return;
    }

    fetch("/api/teams", {
      headers: {
        "x-ado-org": parsed.org,
        "x-ado-project": parsed.project,
        "x-ado-pat": pat,
      },
    })
      .then((res) => {
        if (res.ok) {
          setCreds({ org: parsed.org, project: parsed.project, pat });
        } else {
          try {
            localStorage.removeItem(STORAGE_KEYS.ORG_URL);
            localStorage.removeItem(STORAGE_KEYS.PAT);
          } catch {}
        }
      })
      .catch(() => {
        try {
          localStorage.removeItem(STORAGE_KEYS.ORG_URL);
          localStorage.removeItem(STORAGE_KEYS.PAT);
        } catch {}
      })
      .finally(() => setChecking(false));
  }, []);

  const handleDisconnect = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ORG_URL);
      localStorage.removeItem(STORAGE_KEYS.PAT);
    } catch {}
    setCreds(null);
  };

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

  return <Dashboard creds={creds} onDisconnect={handleDisconnect} />;
}

"use client";

import { useState } from "react";

const STORAGE_KEYS = {
  ORG_URL: "ado-pulse:orgUrl",
  PAT: "ado-pulse:pat",
} as const;

interface ConnectionFormProps {
  onConnect: (creds: { org: string; project: string; pat: string }) => void;
}

function parseOrgUrl(input: string): { org: string; project: string } | null {
  const cleaned = input.trim().replace(/\/+$/, "");

  // Try URL format: https://dev.azure.com/{org}/{project}
  const urlMatch = cleaned.match(
    /dev\.azure\.com\/([^/]+)\/([^/]+)/
  );
  if (urlMatch) {
    return { org: urlMatch[1], project: urlMatch[2] };
  }

  // Try plain format: {org}/{project}
  const plainMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (plainMatch) {
    return { org: plainMatch[1], project: plainMatch[2] };
  }

  return null;
}

export { STORAGE_KEYS, parseOrgUrl };

export function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [orgUrl, setOrgUrl] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ORG_URL) || "";
    } catch {
      return "";
    }
  });
  const [pat, setPat] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PAT) || "";
    } catch {
      return "";
    }
  });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!(
        localStorage.getItem(STORAGE_KEYS.ORG_URL) &&
        localStorage.getItem(STORAGE_KEYS.PAT)
      );
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (connecting) return;
    if (!orgUrl.trim()) return;
    if (!pat.trim()) return;
    setError("");

    const parsed = parseOrgUrl(orgUrl);
    if (!parsed) {
      setError(
        "Enter your org and project \u2014 e.g. https://dev.azure.com/arrivia/softeng"
      );
      return;
    }

    setConnecting(true);

    try {
      const res = await fetch("/api/teams", {
        headers: {
          "x-ado-org": parsed.org,
          "x-ado-project": parsed.project,
          "x-ado-pat": pat.trim(),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        if (res.status === 401) {
          throw new Error(
            "Authentication failed \u2014 check your PAT and organization URL"
          );
        }
        throw new Error(body.error || `Connection failed (${res.status})`);
      }

      try {
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEYS.ORG_URL, orgUrl.trim());
          localStorage.setItem(STORAGE_KEYS.PAT, pat.trim());
        } else {
          localStorage.removeItem(STORAGE_KEYS.ORG_URL);
          localStorage.removeItem(STORAGE_KEYS.PAT);
        }
      } catch {
        // localStorage unavailable or quota exceeded — continue without persisting
      }

      onConnect({
        org: parsed.org,
        project: parsed.project,
        pat: pat.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pulse-bg flex items-center justify-center">
      <div className="animate-fade-up w-[420px] p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pulse-accent/10 text-pulse-accent text-[11px] font-medium tracking-wide uppercase mb-4">
            Azure DevOps
          </div>
          <h1 className="text-2xl font-semibold text-pulse-text leading-tight">
            PR Hygiene Dashboard
          </h1>
          <p className="text-[13px] text-pulse-muted mt-2 leading-relaxed max-w-[320px] mx-auto">
            Monitor team PR activity and review participation across your organization.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-5">
          <div>
            <label
              htmlFor="org-url"
              className="block text-[11px] font-medium text-pulse-muted uppercase tracking-wide mb-1.5"
            >
              Organization URL
            </label>
            <input
              id="org-url"
              type="text"
              className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-lg text-pulse-text text-sm outline-none transition-all focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/10 placeholder:text-pulse-dim"
              placeholder="https://dev.azure.com/your-org/your-project"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="pat"
              className="block text-[11px] font-medium text-pulse-muted uppercase tracking-wide mb-1.5"
            >
              Personal Access Token
            </label>
            <input
              id="pat"
              type="password"
              className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-lg text-pulse-text text-sm outline-none transition-all focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/10 placeholder:text-pulse-dim"
              placeholder="Paste your PAT here"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="accent-pulse-accent w-3.5 h-3.5 cursor-pointer"
          />
          <span className="text-[12px] text-pulse-muted">
            Remember credentials on this browser
          </span>
        </label>

        {error && (
          <div className="mb-4 p-3 bg-pulse-red-bg border border-red-200 rounded-lg">
            <p className="text-[12px] text-pulse-red">{error}</p>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className={`w-full py-2.5 px-6 bg-pulse-accent text-white rounded-lg text-sm font-medium transition-all ${
            connecting
              ? "opacity-60 cursor-wait"
              : "cursor-pointer hover:bg-pulse-accent-hover shadow-sm hover:shadow"
          }`}
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>

        <div className="mt-5 p-3.5 bg-pulse-input rounded-lg border border-pulse-border">
          <p className="text-[11px] text-pulse-muted leading-relaxed">
            Your PAT needs{" "}
            <span className="font-medium text-pulse-secondary">Code (Read)</span>{" "}
            and{" "}
            <span className="font-medium text-pulse-secondary">Policy (Read)</span>{" "}
            scopes. Check &ldquo;Remember credentials&rdquo; to save your
            connection for next time.
          </p>
        </div>
      </div>
    </div>
  );
}

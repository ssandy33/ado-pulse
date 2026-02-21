"use client";

import { useState, useEffect, useRef } from "react";

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

export function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [orgUrl, setOrgUrl] = useState("https://dev.azure.com/arrivia/softeng");
  const [pat, setPat] = useState("");
  const [savePat, setSavePat] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [usingSavedPat, setUsingSavedPat] = useState(false);
  const patInputRef = useRef<HTMLInputElement>(null);

  // Check for saved PAT on mount
  useEffect(() => {
    fetch("/api/settings/integrations/ado")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured && data.source === "settings") {
          setUsingSavedPat(true);
          if (data.orgUrl) {
            setOrgUrl(data.orgUrl);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleUseDifferentPat = () => {
    setUsingSavedPat(false);
    setPat("");
    setTimeout(() => patInputRef.current?.focus(), 0);
  };

  const handleConnect = async () => {
    if (!orgUrl.trim()) return;
    if (!usingSavedPat && !pat.trim()) return;
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
      // When using saved PAT, omit x-ado-pat — server falls back to settings
      const headers: Record<string, string> = {
        "x-ado-org": parsed.org,
        "x-ado-project": parsed.project,
      };
      if (!usingSavedPat) {
        headers["x-ado-pat"] = pat.trim();
      }

      const res = await fetch("/api/teams", { headers });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        if (res.status === 401) {
          throw new Error(
            "Authentication failed \u2014 check your PAT and organization URL"
          );
        }
        throw new Error(body.error || `Connection failed (${res.status})`);
      }

      // Save new PAT to settings if checkbox is checked and using a new PAT
      if (savePat && !usingSavedPat && pat.trim()) {
        await fetch("/api/settings/integrations/ado", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pat: pat.trim(),
            org: parsed.org,
            orgUrl: orgUrl.trim(),
          }),
        }).catch(() => {}); // non-blocking — connect even if save fails
      }

      onConnect({
        org: parsed.org,
        project: parsed.project,
        pat: usingSavedPat ? "" : pat.trim(),
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="pat"
                className="block text-[11px] font-medium text-pulse-muted uppercase tracking-wide"
              >
                Personal Access Token
              </label>
              {usingSavedPat && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
            {usingSavedPat ? (
              <div className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-lg text-sm text-pulse-dim tracking-widest select-none">
                &#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;
              </div>
            ) : (
              <input
                ref={patInputRef}
                id="pat"
                type="password"
                className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-lg text-pulse-text text-sm outline-none transition-all focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/10 placeholder:text-pulse-dim"
                placeholder="Paste your PAT here"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            )}
            {usingSavedPat && (
              <button
                type="button"
                onClick={handleUseDifferentPat}
                className="mt-1.5 text-[11px] text-pulse-accent hover:underline cursor-pointer"
              >
                Use a different PAT
              </button>
            )}
          </div>
          {!usingSavedPat && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={savePat}
                onChange={(e) => setSavePat(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-pulse-input-border text-pulse-accent focus:ring-pulse-accent/20 cursor-pointer"
              />
              <span className="text-[12px] text-pulse-muted">
                Remember my PAT for next time
              </span>
            </label>
          )}
        </div>

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
            scopes. When &ldquo;Remember&rdquo; is checked, the PAT is saved
            locally in data/settings.json.
          </p>
        </div>
      </div>
    </div>
  );
}

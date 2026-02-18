"use client";

import { useState } from "react";

interface ConnectionFormProps {
  onConnect: (creds: { org: string; project: string; pat: string }) => void;
}

export function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [pat, setPat] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConnecting(true);

    try {
      // Validate credentials by fetching teams
      const res = await fetch("/api/teams", {
        headers: {
          "x-ado-org": org.trim(),
          "x-ado-project": project.trim(),
          "x-ado-pat": pat.trim(),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Connection failed (${res.status})`);
      }

      onConnect({ org: org.trim(), project: project.trim(), pat: pat.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pulse-bg flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-1 h-6 bg-pulse-accent rounded-full" />
            <h1 className="text-xl font-semibold text-pulse-text">
              PR Hygiene Dashboard
            </h1>
          </div>
          <p className="text-sm font-mono text-pulse-muted">
            Connect to Azure DevOps
          </p>
        </div>

        <form
          onSubmit={handleConnect}
          className="bg-pulse-card border border-pulse-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-mono text-pulse-muted mb-1">
              Organization
            </label>
            <input
              type="text"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="e.g. arrivia"
              required
              className="w-full bg-pulse-bg border border-pulse-border rounded px-3 py-2 text-sm font-mono text-pulse-text placeholder:text-pulse-muted/50 focus:outline-none focus:border-pulse-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-pulse-muted mb-1">
              Project
            </label>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. softeng"
              required
              className="w-full bg-pulse-bg border border-pulse-border rounded px-3 py-2 text-sm font-mono text-pulse-text placeholder:text-pulse-muted/50 focus:outline-none focus:border-pulse-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-pulse-muted mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Paste your PAT"
              required
              className="w-full bg-pulse-bg border border-pulse-border rounded px-3 py-2 text-sm font-mono text-pulse-text placeholder:text-pulse-muted/50 focus:outline-none focus:border-pulse-accent"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={connecting}
            className="w-full bg-pulse-accent text-white rounded px-4 py-2 text-sm font-mono hover:bg-pulse-accent/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}

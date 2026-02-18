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

  const handleConnect = async () => {
    if (!org.trim() || !project.trim() || !pat.trim()) return;
    setError("");
    setConnecting(true);

    try {
      const res = await fetch("/api/teams", {
        headers: {
          "x-ado-org": org.trim(),
          "x-ado-project": project.trim(),
          "x-ado-pat": pat.trim(),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        if (res.status === 401) {
          throw new Error(
            "Authentication failed — check your PAT and organization"
          );
        }
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
      <div className="animate-fade-up w-[440px] p-10">
        <div className="mb-10 text-center">
          <div className="text-[11px] font-mono text-pulse-accent tracking-[4px] mb-3 uppercase">
            Azure DevOps
          </div>
          <h1 className="text-[28px] font-bold text-pulse-text font-mono leading-tight">
            PR Hygiene Dashboard
          </h1>
          <p className="text-sm text-pulse-muted mt-2 leading-relaxed">
            Monitor team PR activity. Track review participation. Flag low-review
            contributors.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div>
            <label
              htmlFor="org"
              className="block text-[11px] text-pulse-muted font-mono uppercase tracking-[1px] mb-1.5"
            >
              Organization
            </label>
            <input
              id="org"
              type="text"
              className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-md text-pulse-text text-sm font-mono outline-none transition-colors focus:border-pulse-accent placeholder:text-pulse-dim/50"
              placeholder="e.g. arrivia"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="project"
              className="block text-[11px] text-pulse-muted font-mono uppercase tracking-[1px] mb-1.5"
            >
              Project
            </label>
            <input
              id="project"
              type="text"
              className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-md text-pulse-text text-sm font-mono outline-none transition-colors focus:border-pulse-accent placeholder:text-pulse-dim/50"
              placeholder="e.g. softeng"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="pat"
              className="block text-[11px] text-pulse-muted font-mono uppercase tracking-[1px] mb-1.5"
            >
              Personal Access Token
            </label>
            <input
              id="pat"
              type="password"
              className="w-full px-3.5 py-2.5 bg-pulse-input border border-pulse-input-border rounded-md text-pulse-text text-sm font-mono outline-none transition-colors focus:border-pulse-accent placeholder:text-pulse-dim/50"
              placeholder="••••••••••••••••"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#ef444420] border border-[#ef444450] rounded-md">
            <div className="text-[12px] text-[#ef4444] font-mono">{error}</div>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className={`w-full py-2.5 px-6 bg-pulse-accent text-white border-none rounded-md text-sm font-bold font-mono transition-all ${
            connecting
              ? "opacity-60 cursor-wait"
              : "cursor-pointer hover:bg-pulse-accent-hover hover:-translate-y-px"
          }`}
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>

        <div className="mt-6 p-3.5 bg-pulse-input rounded-lg border border-pulse-input-border">
          <div className="text-[11px] text-pulse-muted font-mono leading-relaxed">
            <span className="text-pulse-accent">i</span> Your PAT needs{" "}
            <strong className="text-pulse-text">Code (Read)</strong> scope.
            Credentials stay in your browser — nothing is stored server-side.
          </div>
        </div>
      </div>
    </div>
  );
}

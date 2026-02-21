"use client";

import { useState, useEffect, useRef } from "react";

interface IntegrationState {
  apiToken: string;
  baseUrl: string;
}

interface AdoPatStatus {
  configured: boolean;
  source: "settings" | "env" | "none";
}

interface IntegrationsSettingsProps {
  adoHeaders: Record<string, string>;
}

const DEFAULT_BASE_URL = "https://arrivia.timehub.7pace.com/api/rest";

export function IntegrationsSettings({ adoHeaders }: IntegrationsSettingsProps) {
  // ── 7pace state ──────────────────────────────────────────────
  const [form, setForm] = useState<IntegrationState>({
    apiToken: "",
    baseUrl: DEFAULT_BASE_URL,
  });
  const [saved, setSaved] = useState<IntegrationState>({
    apiToken: "",
    baseUrl: DEFAULT_BASE_URL,
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ── ADO PAT state ────────────────────────────────────────────
  const [adoPat, setAdoPat] = useState("");
  const [showAdoPat, setShowAdoPat] = useState(false);
  const [adoPatStatus, setAdoPatStatus] = useState<AdoPatStatus>({
    configured: false,
    source: "none",
  });
  const [adoTesting, setAdoTesting] = useState(false);
  const [adoTestResult, setAdoTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [adoSaving, setAdoSaving] = useState(false);
  const [adoTestPassed, setAdoTestPassed] = useState(false);
  const [adoSavedFeedback, setAdoSavedFeedback] = useState(false);
  const [adoError, setAdoError] = useState<string | null>(null);
  const adoFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const dirty =
    form.apiToken !== saved.apiToken || form.baseUrl !== saved.baseUrl;

  // Extract org and project from adoHeaders
  const adoOrg = adoHeaders["x-ado-org"] || "";
  const adoProject = adoHeaders["x-ado-project"] || "";
  const adoOrgUrl = adoOrg && adoProject ? `https://dev.azure.com/${adoOrg}/${adoProject}` : "";

  // Load existing settings
  useEffect(() => {
    Promise.all([
      fetch("/api/settings/integrations")
        .then((res) => res.json())
        .then(
          (data: {
            sevenPace: { apiToken: string; baseUrl: string } | null;
          }) => {
            if (data.sevenPace) {
              const state = {
                apiToken: data.sevenPace.apiToken || "",
                baseUrl: data.sevenPace.baseUrl || DEFAULT_BASE_URL,
              };
              setForm(state);
              setSaved(state);
            }
          }
        ),
      fetch("/api/settings/integrations/ado")
        .then((res) => res.json())
        .then((data: AdoPatStatus) => {
          setAdoPatStatus(data);
        }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── 7pace handlers ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sevenPace: { apiToken: form.apiToken, baseUrl: form.baseUrl },
        }),
      });

      if (!res.ok) {
        setSaveError("Failed to save. Please try again.");
        return;
      }

      const data = await res.json();
      const newSaved = {
        apiToken: data.sevenPace?.apiToken || "",
        baseUrl: data.sevenPace?.baseUrl || DEFAULT_BASE_URL,
      };
      setSaved(newSaved);
      setForm(newSaved);
      setSavedFeedback(true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/integrations/7pace/test");
      const data = await res.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `Connected successfully. Found ${data.userCount} user${data.userCount !== 1 ? "s" : ""}.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Connection failed",
        });
      }
    } catch {
      setTestResult({ success: false, message: "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  // ── ADO PAT handlers ────────────────────────────────────────
  const handleAdoTest = async () => {
    setAdoTesting(true);
    setAdoTestResult(null);
    setAdoTestPassed(false);
    try {
      const res = await fetch("/api/settings/integrations/ado/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: adoPat, org: adoOrg }),
      });
      const data = await res.json();

      if (data.success) {
        setAdoTestResult({
          success: true,
          message: `Connected to ${data.orgName}`,
        });
        setAdoTestPassed(true);
      } else {
        setAdoTestResult({
          success: false,
          message: data.error || "Connection failed",
        });
      }
    } catch {
      setAdoTestResult({ success: false, message: "Request failed" });
    } finally {
      setAdoTesting(false);
    }
  };

  const handleAdoSave = async () => {
    setAdoSaving(true);
    setAdoError(null);
    try {
      const res = await fetch("/api/settings/integrations/ado", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: adoPat, org: adoOrg, orgUrl: adoOrgUrl }),
      });
      const data = await res.json();

      if (data.success) {
        setAdoPatStatus({ configured: true, source: "settings" });
        setAdoPat("");
        setAdoTestPassed(false);
        setAdoTestResult(null);
        setAdoSavedFeedback(true);
        if (adoFeedbackTimer.current)
          clearTimeout(adoFeedbackTimer.current);
        adoFeedbackTimer.current = setTimeout(
          () => setAdoSavedFeedback(false),
          2000
        );
      } else {
        setAdoError(data.error || "Failed to save PAT");
      }
    } catch {
      setAdoError("Failed to save PAT");
    } finally {
      setAdoSaving(false);
    }
  };

  const handleAdoRemove = async () => {
    if (!confirm("Remove saved PAT? The app will fall back to the ADO_PAT environment variable if set.")) {
      return;
    }
    try {
      await fetch("/api/settings/integrations/ado", { method: "DELETE" });
      setAdoPatStatus({
        configured: !!process.env.NEXT_PUBLIC_ADO_PAT,
        source: process.env.NEXT_PUBLIC_ADO_PAT ? "env" : "none",
      });
      // Re-fetch actual status from server
      const res = await fetch("/api/settings/integrations/ado");
      const data = await res.json();
      setAdoPatStatus(data);
    } catch {
      setAdoError("Failed to remove PAT");
    }
  };

  if (loading) {
    return (
      <div className="bg-pulse-card border border-pulse-border rounded-lg p-5">
        <div className="animate-pulse h-4 bg-pulse-bg rounded w-48" />
      </div>
    );
  }

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg">
      <div className="px-5 py-4 border-b border-pulse-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-pulse-text">
              Integrations
            </h3>
            <p className="text-[12px] text-pulse-muted mt-0.5">
              Connect external services like Azure DevOps and 7pace
              Timetracker.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-[11px] text-red-600 font-medium">
                {saveError}
              </span>
            )}
            {dirty && !saveError && (
              <span className="text-[11px] text-amber-600 font-medium">
                Unsaved changes
              </span>
            )}
            {savedFeedback && (
              <span className="text-[11px] text-emerald-600 font-medium">
                Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-3 py-1.5 text-[12px] font-medium bg-pulse-accent text-white rounded-md hover:bg-pulse-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* ── Azure DevOps section ─────────────────────────────── */}
        <div>
          <h4 className="text-[13px] font-medium text-pulse-text">
            Azure DevOps
          </h4>
          <p className="text-[11px] text-pulse-muted mt-0.5">
            Personal Access Token for ADO API access.
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              adoPatStatus.source === "settings"
                ? "bg-emerald-500"
                : adoPatStatus.source === "env"
                  ? "bg-blue-500"
                  : "bg-gray-400"
            }`}
          />
          <span className="text-[12px] text-pulse-muted">
            {adoPatStatus.source === "settings" && "Using saved PAT"}
            {adoPatStatus.source === "env" &&
              "Using environment variable (ADO_PAT)"}
            {adoPatStatus.source === "none" && "No PAT configured"}
          </span>
          {adoSavedFeedback && (
            <span className="text-[11px] text-emerald-600 font-medium">
              Saved
            </span>
          )}
        </div>

        {/* PAT input */}
        <div>
          <label className="block text-[12px] font-medium text-pulse-muted mb-1">
            Personal Access Token
          </label>
          <div className="relative">
            <input
              type={showAdoPat ? "text" : "password"}
              value={adoPat}
              onChange={(e) => {
                setAdoPat(e.target.value);
                setAdoTestPassed(false);
                setAdoTestResult(null);
              }}
              placeholder="Enter ADO Personal Access Token"
              className="w-full text-[13px] bg-pulse-bg border border-pulse-border rounded-md px-3 py-2 text-pulse-text pr-16"
            />
            <button
              type="button"
              onClick={() => setShowAdoPat(!showAdoPat)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-pulse-muted hover:text-pulse-text cursor-pointer"
            >
              {showAdoPat ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-[11px] text-pulse-muted mt-1">
            The PAT is stored locally in data/settings.json. Never share this
            file.
          </p>
        </div>

        {/* ADO action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAdoTest}
            disabled={adoTesting || !adoPat.trim() || !adoOrg}
            className="px-3 py-1.5 text-[12px] font-medium text-pulse-text bg-pulse-bg border border-pulse-border rounded-md hover:bg-pulse-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {adoTesting ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleAdoSave}
            disabled={adoSaving || !adoTestPassed}
            className="px-3 py-1.5 text-[12px] font-medium bg-pulse-accent text-white rounded-md hover:bg-pulse-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {adoSaving ? "Saving..." : "Save PAT"}
          </button>
          {adoPatStatus.source === "settings" && (
            <button
              onClick={handleAdoRemove}
              className="px-3 py-1.5 text-[12px] font-medium text-red-600 bg-pulse-bg border border-pulse-border rounded-md hover:bg-red-50 transition-colors cursor-pointer"
            >
              Remove saved PAT
            </button>
          )}
        </div>

        {/* ADO feedback */}
        {adoTestResult && (
          <span
            className={`block text-[12px] font-medium ${
              adoTestResult.success ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {adoTestResult.message}
          </span>
        )}
        {adoError && (
          <span className="block text-[11px] text-red-600 font-medium">
            {adoError}
          </span>
        )}

        {!adoOrg && (
          <p className="text-[11px] text-amber-600">
            Connect to an ADO organization first to test and save a PAT.
          </p>
        )}

        {/* ── Divider ──────────────────────────────────────────── */}
        <div className="border-t border-pulse-border" />

        {/* ── 7pace section ────────────────────────────────────── */}
        <div>
          <h4 className="text-[13px] font-medium text-pulse-text">
            7pace Timetracker
          </h4>
          <p className="text-[11px] text-pulse-muted mt-0.5">
            API credentials for pulling time tracking data.
          </p>
        </div>

        {/* API Token */}
        <div>
          <label className="block text-[12px] font-medium text-pulse-muted mb-1">
            API Token
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={form.apiToken}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, apiToken: e.target.value }))
              }
              placeholder="Enter 7pace API token"
              className="w-full text-[13px] bg-pulse-bg border border-pulse-border rounded-md px-3 py-2 text-pulse-text pr-16"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-pulse-muted hover:text-pulse-text cursor-pointer"
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-[12px] font-medium text-pulse-muted mb-1">
            Base URL
          </label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, baseUrl: e.target.value }))
            }
            placeholder={DEFAULT_BASE_URL}
            className="w-full text-[13px] bg-pulse-bg border border-pulse-border rounded-md px-3 py-2 text-pulse-text"
          />
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !saved.apiToken}
            className="px-3 py-1.5 text-[12px] font-medium text-pulse-text bg-pulse-bg border border-pulse-border rounded-md hover:bg-pulse-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {testResult && (
            <span
              className={`text-[12px] font-medium ${
                testResult.success ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {testResult.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

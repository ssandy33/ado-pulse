"use client";

import { useState, useEffect, useRef } from "react";

interface IntegrationState {
  apiToken: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://arrivia.timehub.7pace.com/api/rest";

export function IntegrationsSettings() {
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

  const dirty =
    form.apiToken !== saved.apiToken || form.baseUrl !== saved.baseUrl;

  // Load existing settings
  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((res) => res.json())
      .then((data: { sevenPace: { apiToken: string; baseUrl: string } | null }) => {
        if (data.sevenPace) {
          const state = {
            apiToken: data.sevenPace.apiToken || "",
            baseUrl: data.sevenPace.baseUrl || DEFAULT_BASE_URL,
          };
          setForm(state);
          setSaved(state);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
              Connect external services like 7pace Timetracker.
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
        {/* 7pace section header */}
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

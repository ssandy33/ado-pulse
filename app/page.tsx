"use client";

import { useState } from "react";
import { ConnectionForm } from "@/components/ConnectionForm";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [creds, setCreds] = useState<{
    org: string;
    project: string;
    pat: string;
  } | null>(null);

  if (!creds) {
    return <ConnectionForm onConnect={setCreds} />;
  }

  return <Dashboard creds={creds} onDisconnect={() => setCreds(null)} />;
}

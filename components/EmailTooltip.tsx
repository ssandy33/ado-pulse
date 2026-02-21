"use client";

import { useState } from "react";

interface EmailTooltipProps {
  displayName: string;
  email: string;
}

export function EmailTooltip({ displayName, email }: EmailTooltipProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span
      className="inline-flex items-center gap-1 cursor-pointer border-b border-dotted border-pulse-dim hover:border-pulse-accent group"
      onClick={handleCopy}
      title={email}
    >
      {displayName}
      {copied ? (
        <span className="text-emerald-600 text-[10px] font-medium">Copied!</span>
      ) : (
        <svg
          className="w-3 h-3 text-pulse-dim opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </span>
  );
}

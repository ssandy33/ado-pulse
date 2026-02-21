"use client";

import { useState } from "react";

interface EmailTooltipProps {
  displayName: string;
  email: string;
}

export function EmailTooltip({ displayName, email }: EmailTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => {
        setVisible(false);
        setCopied(false);
      }}
    >
      <span className="cursor-default border-b border-dotted border-pulse-dim">
        {displayName}
      </span>

      {visible && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 flex items-center gap-2 bg-white border border-pulse-border shadow-md rounded-md px-3 py-1.5 whitespace-nowrap">
          <span className="text-[11px] font-mono text-pulse-muted">{email}</span>
          <button
            onClick={handleCopy}
            className="text-[11px] px-2 py-0.5 rounded border border-pulse-border hover:bg-pulse-hover transition-colors text-pulse-muted flex items-center gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <span className="text-emerald-600">&#10003;</span> Copied!
              </>
            ) : (
              "Copy"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

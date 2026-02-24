"use client";

import { useState, useEffect, useCallback, useId, type ReactNode } from "react";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

const STORAGE_PREFIX = "pulse-section-";

export function CollapsibleSection({
  id,
  title,
  description,
  headerActions,
  children,
  defaultExpanded = true,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const baseId = useId();
  const buttonId = `${baseId}-toggle`;
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const contentId = `${baseId}-content`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (stored !== null) {
        setExpanded(stored === "true");
      }
    } catch {
      // localStorage unavailable
    }
  }, [id]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, [id]);

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg">
      <div
        className={`px-5 py-4${expanded ? " border-b border-pulse-border" : ""}`}
      >
        <div className="flex items-center justify-between">
          <button
            id={buttonId}
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 text-left cursor-pointer"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <svg
              className={`w-4 h-4 text-pulse-muted transition-transform shrink-0 ${
                expanded ? "rotate-0" : "-rotate-90"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <div>
              <span id={titleId} className="block text-[14px] font-semibold text-pulse-text">
                {title}
              </span>
              <span id={descId} className="block text-[12px] text-pulse-muted mt-0.5">
                {description}
              </span>
            </div>
          </button>
          {headerActions}
        </div>
      </div>
      {expanded && (
        <div id={contentId} role="region" aria-labelledby={buttonId}>
          {children}
        </div>
      )}
    </div>
  );
}

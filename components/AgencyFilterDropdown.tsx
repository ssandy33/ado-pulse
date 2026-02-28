"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AgencyFilterDropdownProps {
  agencies: { label: string; employmentType: "fte" | "contractor" | null; count: number }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  disabled?: boolean;
}

export function AgencyFilterDropdown({
  agencies,
  selected,
  onChange,
  disabled,
}: AgencyFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset focus index when dropdown opens/closes
  useEffect(() => {
    if (!open) setFocusIndex(-1);
  }, [open]);

  // Focus the active item when focusIndex changes
  useEffect(() => {
    if (focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]!.focus();
    }
  }, [focusIndex]);

  // Total interactive items: "Clear filter" (if shown) + agencies
  const hasClear = selected.size > 0;
  const itemCount = (hasClear ? 1 : 0) + agencies.length;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % itemCount);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
    }
  }, [open, itemCount]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || agencies.length === 0}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
          selected.size > 0
            ? "bg-pulse-accent/10 text-pulse-accent border-pulse-accent/30"
            : "bg-transparent text-pulse-muted border-pulse-border hover:text-pulse-text"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Agency
        {selected.size > 0 && (
          <span className="ml-0.5 bg-pulse-accent text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
            {selected.size}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute right-0 top-full mt-1 w-52 bg-pulse-card border border-pulse-border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {selected.size > 0 && (
            <button
              ref={(el) => { itemRefs.current[0] = el; }}
              role="menuitem"
              tabIndex={focusIndex === 0 ? 0 : -1}
              onClick={() => { onChange(new Set()); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-[11px] text-pulse-dim hover:text-pulse-red border-b border-pulse-border transition-colors"
            >
              Clear filter
            </button>
          )}
          {agencies.map((agency, i) => {
            const isSelected = selected.has(agency.label);
            const refIndex = (hasClear ? 1 : 0) + i;
            return (
              <button
                key={agency.label}
                ref={(el) => { itemRefs.current[refIndex] = el; }}
                role="menuitemcheckbox"
                aria-checked={isSelected}
                tabIndex={focusIndex === refIndex ? 0 : -1}
                onClick={() => {
                  const next = new Set(selected);
                  if (isSelected) next.delete(agency.label);
                  else next.add(agency.label);
                  onChange(next);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
                  isSelected
                    ? "bg-pulse-accent/5 text-pulse-text"
                    : "text-pulse-muted hover:text-pulse-text hover:bg-pulse-hover"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-pulse-accent border-pulse-accent" : "border-pulse-border"
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[12px]">{agency.label}</span>
                  {agency.employmentType && (
                    <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                      agency.employmentType === "fte"
                        ? "bg-blue-50 text-blue-500"
                        : "bg-amber-50 text-amber-500"
                    }`}>
                      {agency.employmentType === "fte" ? "FTE" : "Contractor"}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-pulse-dim ml-2 flex-shrink-0">{agency.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

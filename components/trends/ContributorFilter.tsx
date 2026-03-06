"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ContributorFilterProps {
  members: Array<{ uniqueName: string; displayName: string }>;
  visible: Set<string>;
  onChange: (visible: Set<string>) => void;
}

export function ContributorFilter({
  members,
  visible,
  onChange,
}: ContributorFilterProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) setFocusIndex(-1);
  }, [open]);

  useEffect(() => {
    if (focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]!.focus();
    }
  }, [focusIndex]);

  // 2 action items (Select All, Clear All) + members
  const itemCount = 2 + members.length;

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

  const selectAll = () => onChange(new Set(members.map((m) => m.displayName)));
  const clearAll = () => onChange(new Set());

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
          visible.size > 0 && visible.size < members.length
            ? "bg-pulse-accent/10 text-pulse-accent border-pulse-accent/30"
            : "bg-transparent text-pulse-muted border-pulse-border hover:text-pulse-text"
        }`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Contributors
        {visible.size > 0 && visible.size < members.length && (
          <span className="ml-0.5 bg-pulse-accent text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
            {visible.size}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full mt-1 w-56 bg-pulse-card border border-pulse-border rounded-lg shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto"
        >
          <div className="flex border-b border-pulse-border">
            <button
              ref={(el) => { itemRefs.current[0] = el; }}
              role="menuitem"
              tabIndex={focusIndex === 0 ? 0 : -1}
              onClick={selectAll}
              className="flex-1 px-3 py-1.5 text-[11px] text-pulse-muted hover:text-pulse-accent transition-colors text-left"
            >
              Select All
            </button>
            <button
              ref={(el) => { itemRefs.current[1] = el; }}
              role="menuitem"
              tabIndex={focusIndex === 1 ? 0 : -1}
              onClick={clearAll}
              className="flex-1 px-3 py-1.5 text-[11px] text-pulse-muted hover:text-pulse-red transition-colors text-left"
            >
              Clear All
            </button>
          </div>
          {members.map((member, i) => {
            const isSelected = visible.has(member.displayName);
            const refIndex = 2 + i;
            return (
              <button
                key={member.uniqueName}
                ref={(el) => { itemRefs.current[refIndex] = el; }}
                role="menuitemcheckbox"
                aria-checked={isSelected}
                tabIndex={focusIndex === refIndex ? 0 : -1}
                onClick={() => {
                  const next = new Set(visible);
                  if (isSelected) next.delete(member.displayName);
                  else next.add(member.displayName);
                  onChange(next);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                  isSelected
                    ? "bg-pulse-accent/5 text-pulse-text"
                    : "text-pulse-muted hover:text-pulse-text hover:bg-pulse-hover"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-pulse-accent border-pulse-accent" : "border-pulse-border"
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-[12px] truncate">{member.displayName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

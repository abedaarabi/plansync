"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { persistViewerStateNow } from "@/lib/syncViewerStatePayload";
import type { TakeoffPackageStatus } from "@/lib/takeoffTypes";
import { useViewerStore } from "@/store/viewerStore";

const OPTIONS: { id: TakeoffPackageStatus; label: string }[] = [
  { id: "draft", label: "DRAFT" },
  { id: "checked", label: "SUBMITTED" },
  { id: "approved", label: "APPROVED" },
];

function labelFor(status: TakeoffPackageStatus): string {
  return OPTIONS.find((o) => o.id === status)?.label ?? "DRAFT";
}

export function TakeoffPackageStatusDropdown({ className = "" }: { className?: string }) {
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);
  const setTakeoffPackageStatus = useViewerStore((s) => s.setTakeoffPackageStatus);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const setAndPersist = (next: TakeoffPackageStatus) => {
    setTakeoffPackageStatus(next);
    persistViewerStateNow();
    setOpen(false);
  };

  const btnClass =
    "viewer-focus-ring inline-flex items-center gap-0.5 rounded-md border border-[#475569] bg-[#0f172a] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#e2e8f0] transition-colors hover:bg-[#1e293b]";

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={btnClass}
      >
        {labelFor(takeoffPackageStatus)}
        <ChevronDown
          className={`h-3 w-3 shrink-0 opacity-80 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-30 mb-1 min-w-[140px] rounded-md border border-[#334155] bg-[#1e293b] py-1 shadow-lg"
          role="listbox"
        >
          {OPTIONS.map((opt) => {
            const sel = takeoffPackageStatus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => setAndPersist(opt.id)}
                className={`flex w-full items-center px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${
                  sel ? "bg-sky-950/50 text-sky-100" : "text-[#f8fafc] hover:bg-[#334155]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

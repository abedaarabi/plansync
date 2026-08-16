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
    "viewer-focus-ring inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition-colors hover:bg-white";

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
          className="absolute bottom-full left-0 z-30 mb-1 min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
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
                  sel ? "bg-sky-50 text-sky-700" : "text-slate-900 hover:bg-slate-100"
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

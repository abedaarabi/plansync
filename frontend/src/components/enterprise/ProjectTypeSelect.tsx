"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getProjectTypeVisual, PROJECT_TYPE_PRESETS } from "@/lib/projectTypeStyle";
import { ProjectTypeChip } from "./ProjectTypeChip";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Match your form field styling (border, padding, focus). */
  triggerClassName: string;
  placeholder?: string;
};

export function ProjectTypeSelect({
  id,
  value,
  onChange,
  triggerClassName,
  placeholder = "Select type (optional)",
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const trimmed = value.trim();
  const isPreset = PROJECT_TYPE_PRESETS.some((p) => p === trimmed);
  const customDraft = isPreset || trimmed === "" ? "" : value;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    if (!triggerRef.current) return;
    function update() {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel = open && coords && (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: coords.width,
        zIndex: 9999,
      }}
      className="max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-lg ring-1 ring-black/5"
    >
      {PROJECT_TYPE_PRESETS.map((preset) => {
        const visual = getProjectTypeVisual(preset);
        if (!visual) return null;
        const { Icon, chipClass } = visual;
        const selected = trimmed === preset;
        return (
          <button
            key={preset}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              onChange(preset);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-[var(--enterprise-hover-surface)] ${
              selected ? "bg-[var(--enterprise-hover-surface)]/80" : ""
            }`}
          >
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 ring-1 ring-inset ${chipClass}`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="min-w-0 font-medium text-[var(--enterprise-text)]">{preset}</span>
          </button>
        );
      })}

      <div className="my-1 border-t border-[var(--enterprise-border)]/80" />
      <div className="px-3 pb-2 pt-1">
        <label className="block text-[11px] font-medium text-[var(--enterprise-text-muted)]">
          Custom type
        </label>
        <input
          value={customDraft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Data center, lab"
          className="mt-1 w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-2.5 py-1.5 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)]/60 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
        />
        {customDraft.trim() ? (
          <div className="mt-2">
            <ProjectTypeChip type={customDraft} />
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 text-left ${triggerClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {trimmed ? (
            <ProjectTypeChip type={value} className="max-w-full" />
          ) : (
            <span className="text-[var(--enterprise-text-muted)]/75">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

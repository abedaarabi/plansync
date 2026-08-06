"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OmAssetRow } from "@/lib/api-client";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";

type OmAssetPickerPreview = {
  id: string;
  tag: string;
  name: string;
  hasImage: boolean;
  category?: string | null;
  locationLabel?: string | null;
  hall?: string | null;
  rowLabel?: string | null;
};

type Props = {
  projectId: string;
  assets: OmAssetRow[];
  value: string;
  onChange: (assetId: string) => void;
  disabled?: boolean;
  label?: string;
  /** Used when disabled and the value is missing from `assets` (e.g. edit mode). */
  lockedPreview?: OmAssetPickerPreview | null;
};

function assetSecondary(a: OmAssetPickerPreview): string | null {
  const parts = [a.category, a.locationLabel, a.hall, a.rowLabel]
    .map((s) => s?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function matchesQuery(a: OmAssetRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    a.tag,
    a.name,
    a.category,
    a.locationLabel,
    a.hall,
    a.rowLabel,
    a.rack,
    a.manufacturer,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function OmAssetPicker({
  projectId,
  assets,
  value,
  onChange,
  disabled = false,
  label = "Asset",
  lockedPreview = null,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected: OmAssetPickerPreview | null =
    assets.find((a) => a.id === value) ?? (lockedPreview?.id === value ? lockedPreview : null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? assets.filter((a) => matchesQuery(a, q)) : assets;
    return list.slice(0, 80);
  }, [assets, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (disabled && selected) {
    return (
      <div>
        <p className={MOBILE_FIELD_LABEL}>{label}</p>
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
            <OmAssetImageThumb
              projectId={projectId}
              assetId={selected.id}
              hasImage={selected.hasImage}
              alt={selected.name}
              fallbackClassName="flex h-12 w-12 items-center justify-center bg-[var(--enterprise-surface)]"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
              <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                {selected.tag}
              </span>
              <span className="text-[var(--enterprise-text-muted)]"> — </span>
              {selected.name}
            </p>
            {assetSecondary(selected) ? (
              <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
                {assetSecondary(selected)}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
              Asset cannot be changed here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div>
        <p className={MOBILE_FIELD_LABEL}>{label}</p>
        <div className="mt-1.5 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">No assets yet</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            Add equipment in the asset register before creating a PPM schedule.
          </p>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/om/assets`}
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-xs font-semibold text-white"
          >
            Go to Assets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={`${listId}-trigger`} className={MOBILE_FIELD_LABEL}>
        {label}
      </label>
      <button
        type="button"
        id={`${listId}-trigger`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`${MOBILE_FIELD_INPUT} mt-1.5 flex w-full items-center gap-3 text-left`}
      >
        {selected ? (
          <>
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
              <OmAssetImageThumb
                projectId={projectId}
                assetId={selected.id}
                hasImage={selected.hasImage}
                alt={selected.name}
                fallbackClassName="flex h-10 w-10 items-center justify-center bg-[var(--enterprise-bg)]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                  {selected.tag}
                </span>
                <span className="text-[var(--enterprise-text-muted)]"> — </span>
                {selected.name}
              </span>
              {assetSecondary(selected) ? (
                <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                  {assetSecondary(selected)}
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-[var(--enterprise-text-muted)]">
            Search and select an asset…
          </span>
        )}
        <ChevronsUpDown
          className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--enterprise-border)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--enterprise-text-muted)]" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag, name, location…"
              className="min-h-9 w-full bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
              aria-label="Search assets"
            />
          </div>
          <ul
            role="listbox"
            aria-labelledby={`${listId}-trigger`}
            className="enterprise-scrollbar max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-[var(--enterprise-text-muted)]">
                No assets match your search.
              </li>
            ) : (
              filtered.map((a) => {
                const active = a.id === value;
                const secondary = assetSecondary(a);
                return (
                  <li key={a.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(a.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--enterprise-hover-surface)] ${
                        active ? "bg-[var(--enterprise-hover-surface)]" : ""
                      }`}
                    >
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
                        <OmAssetImageThumb
                          projectId={projectId}
                          assetId={a.id}
                          hasImage={a.hasImage}
                          alt={a.name}
                          fallbackClassName="flex h-11 w-11 items-center justify-center bg-[var(--enterprise-bg)]"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                          <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                            {a.tag}
                          </span>
                          <span className="text-[var(--enterprise-text-muted)]"> — </span>
                          {a.name}
                        </span>
                        {secondary ? (
                          <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                            {secondary}
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, FileText, Search, X } from "lucide-react";
import type { IssueRow } from "@/lib/api-client";
import {
  ISSUE_STATUS_LABEL,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";

type IssuePick = Pick<
  IssueRow,
  "id" | "title" | "status" | "priority" | "sheetName" | "pageNumber" | "file"
> & {
  file?: { name: string } | null;
};

type Props = {
  issues: IssuePick[];
  value: string[];
  onChange: (issueIds: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

function sheetLabel(i: IssuePick): string | null {
  const name = i.sheetName?.trim() || i.file?.name?.trim();
  if (!name) return null;
  if (i.pageNumber != null) return `${name} · p.${i.pageNumber}`;
  return name;
}

/**
 * Searchable multi-select for linking site issues to an RFI.
 * Selected issues show as removable chips; dropdown lists status + sheet.
 */
export function RfiRelatedIssuesPicker({
  issues,
  value,
  onChange,
  disabled,
  emptyMessage = "No issues match your search.",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

  const selected = useMemo(
    () => value.map((id) => byId.get(id)).filter(Boolean) as IssuePick[],
    [byId, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((i) => {
      const sheet = sheetLabel(i) ?? "";
      const status = ISSUE_STATUS_LABEL[i.status] ?? i.status;
      return (
        i.title.toLowerCase().includes(q) ||
        sheet.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q) ||
        (i.priority ?? "").toLowerCase().includes(q)
      );
    });
  }, [issues, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {selected.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Selected related issues">
          {selected.map((i) => {
            const sheet = sheetLabel(i);
            return (
              <li
                key={i.id}
                className="flex items-start gap-2 rounded-xl border border-[var(--enterprise-primary)]/20 bg-[var(--enterprise-primary-soft)]/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                    {i.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(i.status)}`}
                    >
                      {ISSUE_STATUS_LABEL[i.status] ?? i.status}
                    </span>
                    {i.priority ? (
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClassLight(i.priority)}`}
                      >
                        {i.priority}
                      </span>
                    ) : null}
                    {sheet ? (
                      <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-[var(--enterprise-text-muted)]">
                        <FileText className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{sheet}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(i.id)}
                  className="shrink-0 rounded-md p-1 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-40"
                  aria-label={`Remove ${i.title}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            queueMicrotask(() => inputRef.current?.focus());
          }}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-left text-sm text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {open
              ? "Type to filter…"
              : selected.length > 0
                ? "Add another issue…"
                : "Search issues by title or sheet…"}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <div
            className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-md)]"
            role="listbox"
            aria-multiselectable
          >
            <div className="border-b border-[var(--enterprise-border)] p-2">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, sheet, status…"
                className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2.5 py-2 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                autoComplete="off"
                aria-label="Filter related issues"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                  {issues.length === 0 ? "No issues in this project yet." : emptyMessage}
                </li>
              ) : (
                filtered.map((i) => {
                  const isOn = value.includes(i.id);
                  const sheet = sheetLabel(i);
                  return (
                    <li key={i.id} role="option" aria-selected={isOn}>
                      <button
                        type="button"
                        onClick={() => toggle(i.id)}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition ${
                          isOn
                            ? "bg-[var(--enterprise-primary-soft)]"
                            : "hover:bg-[var(--enterprise-hover-surface)]"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            isOn
                              ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                              : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-transparent"
                          }`}
                          aria-hidden
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--enterprise-text)]">
                            {i.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(i.status)}`}
                            >
                              {ISSUE_STATUS_LABEL[i.status] ?? i.status}
                            </span>
                            {i.priority ? (
                              <span
                                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClassLight(i.priority)}`}
                              >
                                {i.priority}
                              </span>
                            ) : null}
                            {sheet ? (
                              <span className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
                                {sheet}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

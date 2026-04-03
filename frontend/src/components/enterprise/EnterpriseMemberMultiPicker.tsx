"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MemberPickRow = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

type Props = {
  members: MemberPickRow[];
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
  /** Shown when `members` is empty */
  emptyMessage?: string;
};

/**
 * Searchable dropdown to add multiple project members; selected users appear as removable chips.
 */
export function EnterpriseMemberMultiPicker({
  members,
  value,
  onChange,
  disabled,
  emptyMessage = "No members match your search.",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m]));
    return value.map((id) => map.get(id)).filter(Boolean) as MemberPickRow[];
  }, [members, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

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

  function toggle(userId: string) {
    if (value.includes(userId)) onChange(value.filter((id) => id !== userId));
    else onChange([...value, userId]);
  }

  function remove(userId: string) {
    onChange(value.filter((id) => id !== userId));
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected responders">
          {selected.map((m) => (
            <li
              key={m.userId}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-1 pl-2.5 pr-1 text-xs font-medium text-[var(--enterprise-text)]"
            >
              <span className="min-w-0 truncate">{m.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(m.userId)}
                className="shrink-0 rounded-md p-0.5 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-40"
                aria-label={`Remove ${m.name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
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
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-left text-sm text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {open ? "Type to filter…" : "Search members by name or email…"}
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
                placeholder="Name or email…"
                className="w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2.5 py-2 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                autoComplete="off"
                aria-label="Filter members"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                  {members.length === 0 ? "No members available." : emptyMessage}
                </li>
              ) : (
                filtered.map((m) => {
                  const isOn = value.includes(m.userId);
                  return (
                    <li key={m.userId} role="option" aria-selected={isOn}>
                      <button
                        type="button"
                        onClick={() => toggle(m.userId)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                          isOn
                            ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)]"
                            : "text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isOn
                              ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                              : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
                          }`}
                          aria-hidden
                        >
                          {isOn ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-tight">{m.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                            {m.email}
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

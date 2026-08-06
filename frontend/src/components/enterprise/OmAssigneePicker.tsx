"use client";

import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";
import { userInitials } from "@/lib/user-initials";

type OmAssigneeOption = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

function AssigneeAvatar({
  member,
  sizeClass = "h-8 w-8",
  textClass = "text-[10px]",
}: {
  member: Pick<OmAssigneeOption, "name" | "email" | "image"> | null;
  sizeClass?: string;
  textClass?: string;
}) {
  if (!member) {
    return (
      <span
        className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]`}
        aria-hidden
      >
        <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- OAuth / profile URL
      <img
        src={member.image}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border border-[var(--enterprise-border)] object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-primary)]/10 font-bold text-[var(--enterprise-primary)] ${textClass}`}
      aria-hidden
    >
      {userInitials(member.name, member.email)}
    </span>
  );
}

type Props = {
  members: OmAssigneeOption[];
  value: string;
  onChange: (userId: string) => void;
  label?: string;
  disabled?: boolean;
};

export function OmAssigneePicker({
  members,
  value,
  onChange,
  label = "Assigned to",
  disabled = false,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = members.find((m) => m.userId === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

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

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={`${listId}-trigger`} className={MOBILE_FIELD_LABEL}>
        {label}{" "}
        <span className="font-normal text-[var(--enterprise-text-muted)]">(team member)</span>
      </label>
      <button
        type="button"
        id={`${listId}-trigger`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`${MOBILE_FIELD_INPUT} mt-1.5 flex w-full items-center gap-2.5 text-left`}
      >
        <AssigneeAvatar member={selected} />
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                {selected.name.trim() || selected.email}
              </span>
              {selected.name.trim() ? (
                <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                  {selected.email}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-[var(--enterprise-text-muted)]">Unassigned</span>
          )}
        </span>
        <ChevronsUpDown
          className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-lg">
          <div className="border-b border-[var(--enterprise-border)] px-3 py-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="min-h-9 w-full bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
              aria-label="Search team members"
            />
          </div>
          <ul
            role="listbox"
            aria-labelledby={`${listId}-trigger`}
            className="enterprise-scrollbar max-h-56 overflow-y-auto py-1"
          >
            <li role="option" aria-selected={!value}>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--enterprise-hover-surface)] ${
                  !value ? "bg-[var(--enterprise-hover-surface)]" : ""
                }`}
              >
                <AssigneeAvatar member={null} />
                <span className="flex-1 text-sm text-[var(--enterprise-text-muted)]">
                  Unassigned
                </span>
                {!value ? (
                  <Check className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
                ) : null}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--enterprise-text-muted)]">
                No members match.
              </li>
            ) : (
              filtered.map((m) => {
                const active = m.userId === value;
                return (
                  <li key={m.userId} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(m.userId);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--enterprise-hover-surface)] ${
                        active ? "bg-[var(--enterprise-hover-surface)]" : ""
                      }`}
                    >
                      <AssigneeAvatar member={m} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                          {m.name.trim() || m.email}
                        </span>
                        {m.name.trim() ? (
                          <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                            {m.email}
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

/** Compact avatar for table/list cells. */
export function OmAssigneeAvatar({
  member,
  sizeClass = "h-7 w-7",
  textClass = "text-[10px]",
}: {
  member: { name?: string | null; email?: string | null; image?: string | null } | null;
  sizeClass?: string;
  textClass?: string;
}) {
  if (!member) return null;
  return (
    <AssigneeAvatar
      member={{
        name: member.name ?? "",
        email: member.email ?? "",
        image: member.image,
      }}
      sizeClass={sizeClass}
      textClass={textClass}
    />
  );
}

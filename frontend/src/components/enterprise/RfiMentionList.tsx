"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AtSign } from "lucide-react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { userInitials } from "@/lib/user-initials";

export type RfiMentionItem = {
  id: string;
  label: string;
  email?: string | null;
  image?: string | null;
};

export type RfiMentionListProps = SuggestionProps<RfiMentionItem>;

export type RfiMentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export const RfiMentionList = forwardRef<RfiMentionListHandle, RfiMentionListProps>(
  function RfiMentionList(props, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedIndexRef = useRef(0);
    const listRef = useRef<HTMLDivElement>(null);
    selectedIndexRef.current = selectedIndex;

    const selectItem = useCallback(
      (index: number) => {
        const item = props.items[index];
        if (item) props.command(item);
      },
      [props.items, props.command],
    );

    useEffect(() => {
      setSelectedIndex(0);
      selectedIndexRef.current = 0;
    }, [props.items]);

    useEffect(() => {
      const root = listRef.current;
      if (!root) return;
      const btn = root.querySelector<HTMLButtonElement>(
        `button[data-mention-idx="${selectedIndex}"]`,
      );
      btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedIndex, props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        const len = props.items.length;
        if (len === 0) return false;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((i) => {
            const next = (len + i - 1) % len;
            selectedIndexRef.current = next;
            return next;
          });
          return true;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((i) => {
            const next = (i + 1) % len;
            selectedIndexRef.current = next;
            return next;
          });
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const item = props.items[selectedIndexRef.current];
          if (item) props.command(item);
          return true;
        }
        return false;
      },
    }));

    const shellClass =
      "w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_48px_-12px_rgba(0,0,0,0.45)]";

    if (props.items.length === 0) {
      return (
        <div className={shellClass}>
          <div className="flex items-start gap-2.5 px-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <AtSign className="h-4 w-4" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">No matches</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                Try another name or email.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={shellClass} role="listbox" aria-label="Mention a teammate">
        <div className="flex items-center gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-3 py-2 dark:bg-[var(--enterprise-hover-surface)]/40">
          <AtSign
            className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Mention someone
          </span>
        </div>
        <div
          ref={listRef}
          className="enterprise-scrollbar max-h-52 space-y-0.5 overflow-y-auto px-1.5 py-1.5"
        >
          {props.items.map((item, i) => {
            const email = item.email?.trim() ?? null;
            const showEmail = email && email.toLowerCase() !== item.label.trim().toLowerCase();
            const photo = item.image?.trim() || null;
            const initials = userInitials(item.label, email);
            const active = i === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                data-mention-idx={i}
                onClick={() => selectItem(i)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                  active
                    ? "bg-[var(--enterprise-primary)]/10 ring-1 ring-[var(--enterprise-primary)]/20"
                    : "hover:bg-[var(--enterprise-hover-surface)]"
                }`}
              >
                <span
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border text-[10px] font-semibold tabular-nums ${
                    active
                      ? "border-[var(--enterprise-primary)]/35 bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary-deep)] dark:text-[var(--enterprise-primary)]"
                      : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]"
                  }`}
                  aria-hidden
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- profile URL from auth
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                    {item.label}
                  </span>
                  {showEmail ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                      {email}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-1.5 dark:bg-[var(--enterprise-hover-surface)]/25">
          <p className="text-[10px] text-[var(--enterprise-text-muted)]">
            <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1 py-px font-mono text-[9px] font-medium text-[var(--enterprise-text)]">
              ↑↓
            </kbd>{" "}
            move ·{" "}
            <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1 py-px font-mono text-[9px] font-medium text-[var(--enterprise-text)]">
              Enter
            </kbd>{" "}
            select ·{" "}
            <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1 py-px font-mono text-[9px] font-medium text-[var(--enterprise-text)]">
              Esc
            </kbd>{" "}
            close
          </p>
        </div>
      </div>
    );
  },
);

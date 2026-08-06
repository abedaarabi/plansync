"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Hash } from "lucide-react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

export type ProposalMergeFieldItem = {
  id: string;
  label: string;
  value?: string;
};

type ListProps = SuggestionProps<ProposalMergeFieldItem>;

type ListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export const ProposalMergeFieldList = forwardRef<ListHandle, ListProps>(
  function ProposalMergeFieldList(props, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedIndexRef = useRef(0);
    const listRef = useRef<HTMLDivElement>(null);
    selectedIndexRef.current = selectedIndex;

    const selectItem = useCallback(
      (index: number) => {
        const item = props.items[index];
        if (item) props.command(item);
      },
      [props],
    );

    useEffect(() => {
      setSelectedIndex(0);
      selectedIndexRef.current = 0;
    }, [props.items]);

    useEffect(() => {
      const root = listRef.current;
      if (!root) return;
      const btn = root.querySelector<HTMLButtonElement>(
        `button[data-merge-idx="${selectedIndex}"]`,
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
      "w-[min(calc(100vw-1.5rem),20rem)] overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]";

    if (props.items.length === 0) {
      return (
        <div className={shellClass}>
          <div className="px-3 py-3">
            <p className="text-sm font-medium text-[var(--enterprise-text)]">No matching fields</p>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Try another name (e.g. client, project).
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={shellClass} role="listbox" aria-label="Insert merge field">
        <div className="flex items-center gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-3 py-2">
          <Hash
            className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Merge fields
          </span>
        </div>
        <div
          ref={listRef}
          className="enterprise-scrollbar max-h-56 space-y-0.5 overflow-y-auto px-1.5 py-1.5"
        >
          {props.items.map((item, i) => {
            const selected = i === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                data-merge-idx={i}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(i);
                }}
                onMouseEnter={() => {
                  setSelectedIndex(i);
                  selectedIndexRef.current = i;
                }}
                className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition ${
                  selected
                    ? "bg-[var(--enterprise-primary)]/12 text-[var(--enterprise-text)]"
                    : "text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                }`}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="font-mono text-[11px] text-[var(--enterprise-text-muted)]">
                  {`{{${item.id}}}`}
                  {item.value ? ` · ${item.value}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

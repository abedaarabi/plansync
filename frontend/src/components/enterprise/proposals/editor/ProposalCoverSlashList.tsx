"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { Slash } from "lucide-react";

export type CoverSlashItem = {
  id: string;
  label: string;
  description: string;
  run: () => void;
};

type ListProps = SuggestionProps<CoverSlashItem>;

type ListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export const ProposalCoverSlashList = forwardRef<ListHandle, ListProps>(
  function ProposalCoverSlashList(props, ref) {
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
      root
        .querySelector<HTMLButtonElement>(`button[data-slash-idx="${selectedIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
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

    const shell =
      "w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]";

    if (props.items.length === 0) {
      return (
        <div className={shell}>
          <div className="px-3 py-3 text-sm text-[var(--enterprise-text-muted)]">No commands</div>
        </div>
      );
    }

    return (
      <div className={shell} role="listbox" aria-label="Insert block">
        <div className="flex items-center gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-3 py-2">
          <Slash className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Insert
          </span>
        </div>
        <div
          ref={listRef}
          className="enterprise-scrollbar max-h-64 space-y-0.5 overflow-y-auto px-1.5 py-1.5"
        >
          {props.items.map((item, i) => {
            const selected = i === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                data-slash-idx={i}
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
                    ? "bg-[var(--enterprise-primary)]/12"
                    : "hover:bg-[var(--enterprise-hover-surface)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--enterprise-text)]">
                  {item.label}
                </span>
                <span className="text-[11px] text-[var(--enterprise-text-muted)]">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

"use client";

import { Crosshair, MessageSquarePlus, MousePointer2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ViewerMarkupLockActions } from "./ViewerMarkupLockActions";

type Props = {
  clientX: number;
  clientY: number;
  onClose: () => void;
  onAddComment: () => void;
  onSelectTool: () => void;
  hitId: string | null;
  showEditComment: boolean;
  onEditComment: () => void;
  onDelete: () => void;
  onSelectOnlyThis: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  hitLocked: boolean;
  /** When false, Delete is hidden (e.g. issue pins — delete from Issues tab only). */
  showDelete?: boolean;
};

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-900 hover:bg-slate-100";
const iconClass = "h-3.5 w-3.5 shrink-0 text-[var(--viewer-icon)]";

export function SheetContextMenu({
  clientX,
  clientY,
  onClose,
  onAddComment,
  onSelectTool,
  hitId,
  showEditComment,
  onEditComment,
  onDelete,
  onSelectOnlyThis,
  onCopy,
  onDuplicate,
  onToggleLock,
  hitLocked,
  showDelete = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => ({ left: clientX, top: clientY }));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: Math.max(8, Math.min(clientX, vw - r.width - 8)),
      top: Math.max(8, Math.min(clientY, vh - r.height - 8)),
    });
  }, [clientX, clientY]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const menu = (
    <div
      ref={ref}
      role="menu"
      aria-label="Sheet actions"
      className="fixed z-[200] min-w-[12rem] rounded-lg border border-slate-300/90 bg-white py-1 text-[13px] text-slate-900 shadow-2xl ring-1 ring-slate-900/5"
      style={{ left: pos.left, top: pos.top }}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onAddComment();
          onClose();
        }}
      >
        <MessageSquarePlus className={iconClass} aria-hidden strokeWidth={1.75} />
        Add comment…
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onSelectTool();
          onClose();
        }}
      >
        <MousePointer2 className={iconClass} aria-hidden strokeWidth={1.75} />
        Select tool
      </button>
      {hitId && (
        <>
          <div className="my-1 h-px bg-slate-200" />
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onSelectOnlyThis();
              onClose();
            }}
          >
            <Crosshair className={iconClass} aria-hidden strokeWidth={1.75} />
            Select only this
          </button>
          {showEditComment && (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                onEditComment();
                onClose();
              }}
            >
              <Pencil className={iconClass} aria-hidden strokeWidth={1.75} />
              Edit comment…
            </button>
          )}
          <ViewerMarkupLockActions
            locked={hitLocked}
            onCopy={onCopy}
            onDuplicate={onDuplicate}
            onToggleLock={onToggleLock}
            onClose={onClose}
          />
          {showDelete ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 className={iconClass} aria-hidden strokeWidth={1.75} />
              Delete
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}

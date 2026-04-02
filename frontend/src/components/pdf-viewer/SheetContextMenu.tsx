"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
      className="fixed z-[200] min-w-[12rem] rounded-lg border border-slate-600/90 bg-slate-900 py-1 text-[13px] text-slate-100 shadow-2xl ring-1 ring-black/50"
      style={{ left: pos.left, top: pos.top }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
        onClick={() => {
          onAddComment();
          onClose();
        }}
      >
        Add comment…
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
        onClick={() => {
          onSelectTool();
          onClose();
        }}
      >
        Select tool
      </button>
      {hitId && (
        <>
          <div className="my-1 h-px bg-slate-700" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
            onClick={() => {
              onSelectOnlyThis();
              onClose();
            }}
          >
            Select only this
          </button>
          {showEditComment && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
              onClick={() => {
                onEditComment();
                onClose();
              }}
            >
              Edit comment…
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            Copy
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
            onClick={() => {
              onToggleLock();
              onClose();
            }}
          >
            {hitLocked ? "Unlock" : "Lock"}
          </button>
          {showDelete ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              Delete
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}

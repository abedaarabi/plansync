"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ViewerMarkupLockActions } from "./ViewerMarkupLockActions";

type Props = {
  clientX: number;
  clientY: number;
  onClose: () => void;
  locked: boolean;
  onCopy: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
};

const dangerItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50";
const dangerIconClass = "h-3.5 w-3.5 shrink-0 text-red-600";

export function AnnotationListContextMenu({
  clientX,
  clientY,
  onClose,
  locked,
  onCopy,
  onDuplicate,
  onToggleLock,
  onDelete,
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
      aria-label="Markup actions"
      className="fixed z-[200] min-w-[10rem] rounded-lg border border-slate-300/90 bg-white py-1 text-[13px] text-slate-900 shadow-2xl ring-1 ring-slate-900/5"
      style={{ left: pos.left, top: pos.top }}
    >
      <ViewerMarkupLockActions
        locked={locked}
        onCopy={onCopy}
        onDuplicate={onDuplicate}
        onToggleLock={onToggleLock}
        onClose={onClose}
      />
      <button
        type="button"
        role="menuitem"
        className={dangerItemClass}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className={dangerIconClass} aria-hidden strokeWidth={1.75} />
        Delete
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}

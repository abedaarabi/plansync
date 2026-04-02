"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
      className="fixed z-[200] min-w-[10rem] rounded-lg border border-slate-600/90 bg-slate-900 py-1 text-[13px] text-slate-100 shadow-2xl ring-1 ring-black/50"
      style={{ left: pos.left, top: pos.top }}
    >
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
        {locked ? "Unlock" : "Lock"}
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center px-3 py-2 text-left text-red-200 hover:bg-red-950/50"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function BimGlassDock(props: {
  side: "left" | "right";
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  useEffect(() => {
    if (!props.open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-dock-close]")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  if (!props.open) return null;

  return (
    <>
      <button
        type="button"
        className="bim-glass-dock-backdrop"
        aria-label="Close panel"
        onClick={props.onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className="bim-glass-dock bim-glass-surface bim-glass-dock-enter"
        data-side={props.side}
      >
        <div className="bim-glass-dock__header">
          <span className="bim-glass-dock__grab" aria-hidden />
          <div className="bim-glass-dock__header-row">
            <div className="min-w-0 flex-1">
              <p className="bim-panel-header-title">{props.title}</p>
              {props.subtitle ? <p className="bim-panel-header-sub">{props.subtitle}</p> : null}
            </div>
            <button
              type="button"
              data-dock-close
              onClick={props.onClose}
              aria-label="Close panel"
              className="bim-focus-ring bim-rail-btn mobile-touch-target"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="bim-glass-dock__body">{props.children}</div>
      </aside>
    </>
  );
}

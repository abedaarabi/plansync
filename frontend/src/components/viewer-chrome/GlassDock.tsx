"use client";

import { useEffect, type ReactNode } from "react";
import { GripVertical, X, type LucideIcon } from "lucide-react";
import { useDockDrag } from "./useDockDrag";

export type ChromeDockTone = "viewer" | "bim";

export function GlassDock(props: {
  tone?: ChromeDockTone;
  side: "left" | "right";
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onClose: () => void;
  closeOnOutsideClick?: boolean;
  liftForBottomChrome?: boolean;
  /** Allow dragging the panel by its header to any spot over the canvas. */
  movable?: boolean;
  children: ReactNode;
}) {
  const tone = props.tone ?? "viewer";
  const prefix = tone === "bim" ? "bim" : "viewer";
  const Icon = props.icon;
  const movable = props.movable === true;
  const { panelRef, panelStyle, handleProps } = useDockDrag(movable);
  const closeOnOutsideClick = props.closeOnOutsideClick !== false;

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

  const focusBtn =
    tone === "bim" ? "bim-focus-ring bim-rail-btn" : "viewer-focus-ring viewer-rail-btn";

  return (
    <>
      {closeOnOutsideClick ? (
        <button
          type="button"
          className={`${prefix}-glass-dock-backdrop`}
          aria-label="Close panel"
          onClick={props.onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal={closeOnOutsideClick}
        aria-label={props.title}
        data-side={props.side}
        data-lift={props.liftForBottomChrome ? "bottom-chrome" : undefined}
        style={panelStyle}
        className={`${prefix}-glass-dock ${prefix}-glass-surface ${prefix}-glass-dock-enter`}
      >
        <div
          className={`${prefix}-glass-dock__header`}
          data-movable={movable ? "true" : undefined}
          {...(movable ? handleProps : null)}
        >
          <span className={`${prefix}-glass-dock__grab`} aria-hidden />
          <div className={`${prefix}-glass-dock__header-row`}>
            {movable ? (
              <span
                className={`${prefix}-glass-dock__grip`}
                title="Drag to move, double-click to reset"
                aria-hidden
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            ) : null}
            {Icon ? (
              <span className={`${prefix}-glass-dock__icon`} aria-hidden>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className={tone === "bim" ? "bim-panel-header-title" : "viewer-dock-header-title"}>
                {props.title}
              </p>
              {props.subtitle ? (
                <p className={tone === "bim" ? "bim-panel-header-sub" : "viewer-dock-header-sub"}>
                  {props.subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              data-dock-close
              onClick={props.onClose}
              aria-label="Close panel"
              className={`${focusBtn} mobile-touch-target`}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className={`${prefix}-glass-dock__body`}>{props.children}</div>
      </aside>
    </>
  );
}

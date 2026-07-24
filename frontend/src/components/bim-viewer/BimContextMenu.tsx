"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 192;
const MENU_HEIGHT = 320;

function clampMenuPosition(x: number, y: number) {
  const pad = 8;
  const maxX = window.innerWidth - MENU_WIDTH - pad;
  const maxY = window.innerHeight - MENU_HEIGHT - pad;
  return {
    x: Math.min(Math.max(pad, x), maxX),
    y: Math.min(Math.max(pad, y), maxY),
  };
}

export function BimContextMenu(props: {
  x: number;
  y: number;
  hasSelection: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const position = useMemo(() => clampMenuPosition(props.x, props.y), [props.x, props.y]);

  const items = props.hasSelection
    ? [
        { id: "zoom", label: "Zoom to selection" },
        { id: "isolate", label: "Isolate" },
        { id: "xray", label: "Isolate in X-Ray" },
        { id: "section", label: "Section box on selection" },
        { id: "hide", label: "Hide" },
        { id: "properties", label: "Properties" },
        { id: "createIssue", label: "Create issue" },
        { id: "showAll", label: "Show all objects", muted: true },
      ]
    : [{ id: "showAll", label: "Show all objects" }];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="bim-context-menu-portal">
      <button
        type="button"
        className="fixed inset-0 z-[100] cursor-default bg-slate-900/5"
        aria-label="Close menu"
        onMouseDown={(e) => {
          if (e.button === 0) props.onClose();
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="bim-glass-surface fixed z-[101] min-w-[12rem] overflow-hidden rounded-xl py-1"
        style={{ left: position.x, top: position.y }}
        role="menu"
      >
        {props.hasSelection ? (
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-chrome-text-muted)]">
            Selection
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            data-muted={"muted" in item && item.muted ? "true" : undefined}
            onClick={() => {
              props.onAction(item.id);
              props.onClose();
            }}
            className="block w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--bim-chrome-text)] transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--bim-chrome-surface)_70%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bim-accent)]"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

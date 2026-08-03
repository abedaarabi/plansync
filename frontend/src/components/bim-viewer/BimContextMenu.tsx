"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 192;
const MENU_HEIGHT = 400;

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
  /** When true, show “Add asset” (O&M assets module enabled). */
  canCreateAsset?: boolean;
  /** Linked O&M asset tag for the current selection, if any. */
  linkedAssetTag?: string | null;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMemo(() => clampMenuPosition(props.x, props.y), [props.x, props.y]);
  const ranAction = useRef(false);

  const assetItem = props.linkedAssetTag
    ? { id: "viewAsset", label: `View asset (${props.linkedAssetTag})` }
    : props.canCreateAsset
      ? { id: "createAsset", label: "Add asset" }
      : null;

  const items = props.hasSelection
    ? [
        { id: "zoom", label: "Zoom to selection" },
        { id: "isolate", label: "Isolate" },
        { id: "xray", label: "Isolate in X-Ray" },
        { id: "section", label: "Section box on selection" },
        { id: "hide", label: "Hide" },
        { id: "properties", label: "Properties" },
        { id: "createIssue", label: "Create issue" },
        ...(assetItem ? [assetItem] : []),
        { id: "showAll", label: "Show all objects", muted: true },
      ]
    : [{ id: "showAll", label: "Show all objects" }];

  useEffect(() => {
    ranAction.current = false;
    const onDocDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    // Capture phase so the viewer canvas doesn't eat the dismiss.
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [props.onClose]);

  const runAction = (id: string) => {
    if (ranAction.current) return;
    ranAction.current = true;
    props.onAction(id);
    props.onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="bim-context-menu-portal">
      <div
        ref={menuRef}
        className="bim-glass-surface fixed z-[101] min-w-[12rem] overflow-hidden rounded-xl py-1"
        style={{ left: position.x, top: position.y }}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
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
            onPointerDown={(e) => {
              // Fire on pointerdown so the action isn't lost if the menu unmounts
              // before click (viewer / capture handlers).
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              runAction(item.id);
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

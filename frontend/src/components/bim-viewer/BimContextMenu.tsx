"use client";

import type { LucideIcon } from "lucide-react";
import {
  BoxSelect,
  CircleAlert,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Package,
  Scan,
  ScanSearch,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 220;
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

type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  muted?: boolean;
};

export function BimContextMenu(props: {
  x: number;
  y: number;
  hasSelection: boolean;
  /** When true, show “Add asset” (O&M assets module enabled). */
  canCreateAsset?: boolean;
  /** O&M / operations project — create WORK_ORDER kind under the hood, labeled as issue. */
  operationsMode?: boolean;
  /** Linked O&M asset tag for the current selection, if any. */
  linkedAssetTag?: string | null;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMemo(() => clampMenuPosition(props.x, props.y), [props.x, props.y]);
  const ranAction = useRef(false);

  const assetItem: MenuItem | null = props.linkedAssetTag
    ? { id: "viewAsset", label: `View asset (${props.linkedAssetTag})`, icon: Package }
    : props.canCreateAsset
      ? { id: "createAsset", label: "Add asset", icon: Package }
      : null;

  /** Ops creates WORK_ORDER kind; construction creates CONSTRUCTION — both labeled issue. */
  const createItems: MenuItem[] = props.operationsMode
    ? [{ id: "createWorkOrder", label: "Create issue", icon: CircleAlert }]
    : [{ id: "createIssue", label: "Create issue", icon: CircleAlert }];

  const items: MenuItem[] = props.hasSelection
    ? [
        { id: "zoom", label: "Zoom to selection", icon: Crosshair },
        { id: "isolate", label: "Isolate", icon: ScanSearch },
        { id: "xray", label: "Isolate in X-Ray", icon: Scan },
        { id: "section", label: "Section box on selection", icon: BoxSelect },
        { id: "hide", label: "Hide", icon: EyeOff },
        { id: "properties", label: "Properties", icon: Info },
        ...createItems,
        ...(assetItem ? [assetItem] : []),
        { id: "showAll", label: "Show all objects", icon: Eye, muted: true },
      ]
    : [{ id: "showAll", label: "Show all objects", icon: Eye }];

  useEffect(() => {
    ranAction.current = false;
    const onDocDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    // Capture pointerdown so iPad taps outside dismiss (mousedown alone is unreliable).
    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocDown, true);
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
    <div className="bim-theme bim-context-menu-portal">
      <div
        ref={menuRef}
        className="bim-glass-surface fixed z-[101] min-w-[13.5rem] overflow-hidden rounded-xl py-1"
        style={{ left: position.x, top: position.y }}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
      >
        {props.hasSelection ? (
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-chrome-text-muted)]">
            Selection
          </p>
        ) : null}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              data-muted={item.muted ? "true" : undefined}
              onPointerDown={(e) => {
                // Fire on pointerdown so the action isn't lost if the menu unmounts
                // before click (viewer / capture handlers).
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                runAction(item.id);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[var(--bim-chrome-text)] transition-colors duration-100 hover:bg-[var(--bim-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bim-accent)] data-[muted=true]:text-[var(--bim-chrome-text-muted)]"
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-[var(--bim-icon)]"
                aria-hidden
                strokeWidth={1.75}
              />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

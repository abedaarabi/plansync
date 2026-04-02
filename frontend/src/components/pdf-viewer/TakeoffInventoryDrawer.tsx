"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { BottomDrawer } from "./BottomDrawer";
import type { BottomDrawerSnap } from "@/lib/bottomDrawerSnap";
import { fileFingerprint } from "@/lib/sessionPersistence";
import { loadInventoryDrawerState, saveInventoryDrawerState } from "@/lib/inventoryDrawerStorage";
import { useViewerStore } from "@/store/viewerStore";
import { TakeoffInventoryPanel } from "./TakeoffInventoryPanel";
import { TakeoffPackageStatusDropdown } from "./TakeoffPackageStatusDropdown";

/** ~top chrome (viewer toolbar); drawer won’t cover it when “full screen”. */
const VIEWPORT_TOP_RESERVE_PX = 52;

const RESIZE_DEBOUNCE_MS = 120;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function TakeoffInventoryDrawerBody({
  fileFingerprintKey,
  embedded,
}: {
  fileFingerprintKey: string;
  embedded?: boolean;
}) {
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const expandNonce = useViewerStore((s) => s.takeoffInventoryExpandNonce);
  const takeoffRedrawZoneId = useViewerStore((s) => s.takeoffRedrawZoneId);
  const takeoffMoveZoneId = useViewerStore((s) => s.takeoffMoveZoneId);
  const takeoffVertexEditZoneId = useViewerStore((s) => s.takeoffVertexEditZoneId);
  const bumpTakeoffInventoryExpand = useViewerStore((s) => s.bumpTakeoffInventoryExpand);
  const setTool = useViewerStore((s) => s.setTool);
  const setTakeoffMode = useViewerStore((s) => s.setTakeoffMode);

  const persisted = useMemo(
    () => (typeof window !== "undefined" ? loadInventoryDrawerState(fileFingerprintKey) : null),
    [fileFingerprintKey],
  );

  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const [inventoryFullscreen, setInventoryFullscreen] = useState(
    () => persisted?.inventoryFullscreen ?? false,
  );
  const [expandFullscreenNonce, setExpandFullscreenNonce] = useState(0);
  const [collapseToHalfNonce, setCollapseToHalfNonce] = useState(0);

  const inventoryFullscreenRef = useRef(inventoryFullscreen);
  inventoryFullscreenRef.current = inventoryFullscreen;

  const currentSnapRef = useRef<BottomDrawerSnap>(persisted?.snap ?? "collapsed");

  const drawerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = undefined;
        setVh(window.innerHeight);
      }, RESIZE_DEBOUNCE_MS);
    };
    ro();
    window.addEventListener("resize", ro);
    return () => {
      window.removeEventListener("resize", ro);
      if (t) clearTimeout(t);
    };
  }, []);

  const fullViewportSnapPx = useMemo(() => {
    const h = Math.max(240, vh - VIEWPORT_TOP_RESERVE_PX);
    return Math.min(h, Math.round(vh * 0.94));
  }, [vh]);

  const snapHeightsPx = useMemo(
    () =>
      inventoryFullscreen ? ([40, 200, fullViewportSnapPx] as const) : ([40, 200, 400] as const),
    [inventoryFullscreen, fullViewportSnapPx],
  );

  const toggleInventoryFullscreen = useCallback(() => {
    setInventoryFullscreen((prev) => {
      const next = !prev;
      inventoryFullscreenRef.current = next;
      if (!next) {
        setCollapseToHalfNonce((n) => n + 1);
      } else {
        setExpandFullscreenNonce((n) => n + 1);
      }
      return next;
    });
  }, []);

  const onSnapSettled = useCallback(
    (info: { snap: BottomDrawerSnap; heightPx: number }) => {
      currentSnapRef.current = info.snap;
      saveInventoryDrawerState(fileFingerprintKey, {
        snap: info.snap,
        inventoryFullscreen: inventoryFullscreenRef.current,
      });
    },
    [fileFingerprintKey],
  );

  useEffect(() => {
    saveInventoryDrawerState(fileFingerprintKey, {
      snap: currentSnapRef.current,
      inventoryFullscreen,
    });
  }, [inventoryFullscreen, fileFingerprintKey]);

  const zoneCount = takeoffZones.length;
  const itemCount = takeoffItems.length;

  const startTakeoffFromCollapsed = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setTool("takeoff");
      setTakeoffMode(true);
      bumpTakeoffInventoryExpand();
    },
    [bumpTakeoffInventoryExpand, setTakeoffMode, setTool],
  );

  useEffect(() => {
    if (!inventoryFullscreen) return;
    const root = drawerRef.current;
    if (!root) return;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );

    const list = focusables();
    if (list.length > 0) list[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [inventoryFullscreen]);

  const initialSnap: BottomDrawerSnap = persisted?.snap ?? "collapsed";

  const titleMain = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 text-[11px] text-[#e2e8f0]">
        <span className="font-medium text-[#94a3b8]">Inventory</span>{" "}
        <span className="tabular-nums text-[#f1f5f9]">
          {itemCount} {itemCount === 1 ? "item" : "items"} · {zoneCount}{" "}
          {zoneCount === 1 ? "zone" : "zones"}
        </span>
      </span>
      <TakeoffPackageStatusDropdown />
    </span>
  );

  const titleCollapsed =
    itemCount === 0 ? (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 text-[11px] text-[#e2e8f0]">
          <span className="font-medium text-[#94a3b8]">Inventory</span>{" "}
          <span className="text-[#cbd5e1]">No takeoff lines yet</span>
        </span>
        <button
          type="button"
          className="viewer-focus-ring shrink-0 rounded-md border border-[#475569] bg-[#1e293b] px-2 py-0.5 text-[10px] font-semibold text-[#e2e8f0] hover:bg-[#334155]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={startTakeoffFromCollapsed}
        >
          Start takeoff
        </button>
        <TakeoffPackageStatusDropdown />
      </span>
    ) : (
      titleMain
    );

  const inner = (
    <div
      className={`pointer-events-auto w-full max-w-full min-w-0 ${embedded ? "px-0 pb-0" : "px-1 pb-0 sm:px-2"}`}
    >
      <BottomDrawer
        ref={drawerRef}
        snapHeightsPx={snapHeightsPx}
        initialSnap={initialSnap}
        onSnapSettled={onSnapSettled}
        expandRequestNonce={expandNonce}
        expandFullscreenNonce={expandFullscreenNonce}
        collapseToHalfNonce={collapseToHalfNonce}
        inventoryFullscreen={inventoryFullscreen}
        escapeToCollapseEnabled={
          !takeoffRedrawZoneId && !takeoffMoveZoneId && !takeoffVertexEditZoneId
        }
        title={titleMain}
        titleWhenCollapsed={titleCollapsed}
        headerRight={
          <div
            className="flex shrink-0 items-center gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={toggleInventoryFullscreen}
              title={inventoryFullscreen ? "Exit full screen (inventory)" : "Full screen inventory"}
              aria-pressed={inventoryFullscreen}
              className="viewer-focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#475569] bg-[#0f172a] text-[#e2e8f0] transition-colors hover:bg-[#1e293b]"
            >
              {inventoryFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
        }
      >
        <TakeoffInventoryPanel />
      </BottomDrawer>
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="no-print pointer-events-none absolute inset-x-0 bottom-0 z-[25] flex justify-center px-0">
      {inner}
    </div>
  );
}

export function TakeoffInventoryDrawer({ embedded = false }: { embedded?: boolean }) {
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const fp = useMemo(() => fileFingerprint(fileName, numPages), [fileName, numPages]);

  return <TakeoffInventoryDrawerBody key={fp} fileFingerprintKey={fp} embedded={embedded} />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileText, Printer } from "lucide-react";
import { buildTakeoffCsv, downloadTakeoffCsv } from "@/lib/exportTakeoffCsv";
import { openTakeoffPrintReport } from "@/lib/exportTakeoffReport";
import { useViewerStore } from "@/store/viewerStore";
import { BottomDrawer } from "./BottomDrawer";
import { TakeoffInventoryPanel } from "./TakeoffInventoryPanel";

/**
 * Bottom inventory drawer over the canvas column only. z-[25]: below takeoff slider (85) and modals (90).
 * Fixed snap heights (40 / 200 / 400 px) match ACC-style inventory default vs expanded vs full strip.
 */
export function TakeoffInventoryDrawer() {
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const fileName = useViewerStore((s) => s.fileName);
  const expandNonce = useViewerStore((s) => s.takeoffInventoryExpandNonce);
  const takeoffRedrawZoneId = useViewerStore((s) => s.takeoffRedrawZoneId);
  const takeoffMoveZoneId = useViewerStore((s) => s.takeoffMoveZoneId);
  const takeoffVertexEditZoneId = useViewerStore((s) => s.takeoffVertexEditZoneId);
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);

  const [exportOpen, setExportOpen] = useState(false);
  const exportWrapRef = useRef<HTMLDivElement>(null);

  const base = (fileName ?? "sheet").replace(/\.pdf$/i, "");

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportWrapRef.current?.contains(e.target as Node)) return;
      setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  const onExportCsv = () => {
    setExportOpen(false);
    const csv = buildTakeoffCsv(takeoffItems, takeoffZones, fileName ?? "sheet", {
      packageStatus: takeoffPackageStatus,
    });
    downloadTakeoffCsv(`${base}-takeoff.csv`, csv);
  };

  const onExportPrintPdf = () => {
    setExportOpen(false);
    openTakeoffPrintReport(takeoffItems, takeoffZones, fileName ?? "sheet", {
      packageStatus: takeoffPackageStatus,
    });
  };

  const zoneCount = takeoffZones.length;
  const itemCount = takeoffItems.length;

  return (
    <div className="no-print pointer-events-none absolute inset-x-0 bottom-0 z-[25] flex justify-center px-0">
      <div className="pointer-events-auto w-full max-w-full min-w-0 px-1 pb-0 sm:px-2">
        <BottomDrawer
          snapHeightsPx={[40, 200, 400]}
          expandRequestNonce={expandNonce}
          escapeToCollapseEnabled={
            !takeoffRedrawZoneId && !takeoffMoveZoneId && !takeoffVertexEditZoneId
          }
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums text-[11px] text-[#e2e8f0]">
                Inventory · {itemCount} {itemCount === 1 ? "line" : "lines"} · {zoneCount}{" "}
                {zoneCount === 1 ? "zone" : "zones"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  takeoffPackageStatus === "approved"
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35"
                    : takeoffPackageStatus === "checked"
                      ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/35"
                      : "bg-slate-600/40 text-slate-300 ring-1 ring-slate-500/40"
                }`}
              >
                {takeoffPackageStatus === "draft"
                  ? "Draft"
                  : takeoffPackageStatus === "checked"
                    ? "Checked"
                    : "Approved"}
              </span>
            </span>
          }
          headerRight={
            <div
              className="relative"
              ref={exportWrapRef}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={takeoffItems.length === 0}
                className="viewer-focus-ring inline-flex items-center gap-1 rounded-md border border-[#475569] bg-[#0f172a] px-2 py-1 text-[10px] font-medium text-[#e2e8f0] transition-colors duration-150 hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3 w-3" strokeWidth={2} aria-hidden />
                Export
                <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
              </button>
              {exportOpen ? (
                <div
                  className="absolute right-0 bottom-full z-20 mb-1 min-w-[180px] rounded-md border border-[#334155] bg-[#1e293b] py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onExportCsv}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#f8fafc] hover:bg-[#334155]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                    Download CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onExportPrintPdf}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#f8fafc] hover:bg-[#334155]"
                  >
                    <Printer className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                    Print / Save as PDF
                  </button>
                </div>
              ) : null}
            </div>
          }
        >
          <TakeoffInventoryPanel />
        </BottomDrawer>
      </div>
    </div>
  );
}

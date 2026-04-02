"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";
import { sumZonesForItem } from "@/lib/takeoffCompute";
import { buildTakeoffCsv, downloadTakeoffCsv } from "@/lib/exportTakeoffCsv";

export function TakeoffSummaryModal() {
  const open = useViewerStore((s) => s.takeoffSummaryOpen);
  const setOpen = useViewerStore((s) => s.setTakeoffSummaryOpen);
  const items = useViewerStore((s) => s.takeoffItems);
  const zones = useViewerStore((s) => s.takeoffZones);
  const fileName = useViewerStore((s) => s.fileName);
  const currentPage = useViewerStore((s) => s.currentPage);
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);

  if (typeof document === "undefined" || !open) return null;

  const base = (fileName ?? "sheet").replace(/\.pdf$/i, "");

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Takeoff summary"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="max-h-[min(90vh,560px)] w-full max-w-md overflow-hidden rounded-xl border border-[#334155] bg-[#0f172a] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[#f8fafc]">Takeoff summary</h2>
          <button
            type="button"
            className="rounded-md p-1.5 text-[#94a3b8] hover:bg-[#334155] hover:text-white"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-[#334155] px-4 py-2 text-[10px] text-[#94a3b8]">
          Page {currentPage} · {items.length} items · {zones.length} zones · Status:{" "}
          <span className="font-semibold text-[#cbd5e1]">{takeoffPackageStatus}</span>
        </div>
        <div className="max-h-[min(50vh,320px)] overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          <table className="w-full text-left text-[11px] text-[#e2e8f0]">
            <thead>
              <tr className="border-b border-[#334155] text-[9px] uppercase tracking-wide text-[#64748b]">
                <th className="py-1.5 pr-2">Item</th>
                <th className="py-1.5 pr-2">Qty</th>
                <th className="py-1.5">Unit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-[#334155]/60">
                  <td className="py-2 pr-2 font-medium">{it.name}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    {sumZonesForItem(zones, it.id).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 text-[#94a3b8]">{it.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[#64748b]">No takeoff items yet.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#334155] px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-[#475569] px-3 py-2 text-[11px] font-medium text-[#e2e8f0] hover:bg-[#334155]"
            onClick={() => {
              const csv = buildTakeoffCsv(items, zones, fileName ?? "sheet", {
                packageStatus: takeoffPackageStatus,
              });
              downloadTakeoffCsv(`${base}-takeoff.csv`, csv);
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md bg-[#2563eb] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#1d4ed8]"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useViewerStore } from "@/store/viewerStore";
import { sumZonesForItem } from "@/lib/takeoffCompute";
import { buildTakeoffCsv, downloadTakeoffCsv } from "@/lib/exportTakeoffCsv";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

export function TakeoffSummaryModal() {
  const open = useViewerStore((s) => s.takeoffSummaryOpen);
  const setOpen = useViewerStore((s) => s.setTakeoffSummaryOpen);
  const items = useViewerStore((s) => s.takeoffItems);
  const zones = useViewerStore((s) => s.takeoffZones);
  const fileName = useViewerStore((s) => s.fileName);
  const currentPage = useViewerStore((s) => s.currentPage);
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);

  const base = (fileName ?? "sheet").replace(/\.pdf$/i, "");

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      ariaLabelledBy="takeoff-summary-title"
      variant="viewer-dark"
      overlayZClass="z-[90]"
      panelClassName="max-w-md p-0"
      bodyClassName="overflow-hidden"
      footerClassName="border-t border-[#334155] px-4 py-3 mt-0"
      footer={
        <>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-[#2563eb] text-[11px] font-semibold text-white hover:bg-[#1d4ed8]`}
            onClick={() => setOpen(false)}
          >
            Done
          </button>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[#475569] text-[11px] font-medium text-[#e2e8f0] hover:bg-[#334155]`}
            onClick={() => {
              const csv = buildTakeoffCsv(items, zones, fileName ?? "sheet", {
                packageStatus: takeoffPackageStatus,
              });
              downloadTakeoffCsv(`${base}-takeoff.csv`, csv);
            }}
          >
            Export CSV
          </button>
        </>
      }
    >
      <div className="border-b border-[#334155] px-4 py-3">
        <h2 id="takeoff-summary-title" className="text-[13px] font-semibold text-[#f8fafc]">
          Takeoff summary
        </h2>
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
    </EnterpriseResponsiveDialog>
  );
}

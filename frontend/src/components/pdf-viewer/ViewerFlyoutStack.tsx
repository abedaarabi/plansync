"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";
import { DEFAULT_SHEET_OVERLAY_VISIBILITY } from "@/lib/viewerSheetOverlay";
import { MapSnapPanelBody } from "./ViewerRightPanel";

const FLYOUT_W = 300;

function FlyoutChrome({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0F172A] text-[#F8FAFC] shadow-[-12px_0_28px_-10px_rgba(0,0,0,0.45)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#334155] px-3 py-2.5">
        <h2 className="truncate text-[12px] font-semibold tracking-tight text-[#F8FAFC]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] transition hover:border-[#475569] hover:bg-[#334155] hover:text-[#F8FAFC]"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  );
}

function SettingsFlyoutBody() {
  const sheetOverlayVisibility = useViewerStore((s) => s.sheetOverlayVisibility);
  const patchSheetOverlayVisibility = useViewerStore((s) => s.patchSheetOverlayVisibility);
  const setSheetOverlayVisibilityAll = useViewerStore((s) => s.setSheetOverlayVisibilityAll);

  return (
    <div className="space-y-4 px-3 py-3 text-[11px] text-[#CBD5E1]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
        Sheet overlays
      </p>
      <p className="text-[10px] leading-snug text-[#94A3B8]">
        Choose what appears on the drawing (same options as in this settings panel).
      </p>
      <div className="space-y-2 rounded-lg border border-[#334155] bg-[#1E293B] p-2.5">
        {(
          [
            ["showMarkups", "Markups and comments"],
            ["showMeasurements", "Measurements"],
            ["showIssuePins", "Issues and work orders"],
            ["showAssetPins", "Asset pins"],
            ["showTakeoff", "Quantity takeoff"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-[#334155]/80"
          >
            <input
              type="checkbox"
              className="rounded border-[#475569] bg-[#0F172A] text-[#2563EB] accent-[#2563EB]"
              checked={sheetOverlayVisibility[key]}
              onChange={(e) => patchSheetOverlayVisibility({ [key]: e.target.checked })}
            />
            <span className="text-[#E2E8F0]">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="rounded-lg border border-[#334155] bg-[#1E293B] px-2 py-2 text-left text-[11px] font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155]"
          onClick={() =>
            setSheetOverlayVisibilityAll({
              showMarkups: false,
              showMeasurements: false,
              showIssuePins: false,
              showAssetPins: false,
              showTakeoff: false,
            })
          }
        >
          Drawing only (hide all)
        </button>
        <button
          type="button"
          className="rounded-lg border border-[#334155] bg-[#1E293B] px-2 py-2 text-left text-[11px] font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155]"
          onClick={() => setSheetOverlayVisibilityAll({ ...DEFAULT_SHEET_OVERLAY_VISIBILITY })}
        >
          Show all overlays
        </button>
      </div>
    </div>
  );
}

/**
 * Slides in from the right: navy sheet settings (map, snap, saved views, overlays).
 */
export function ViewerFlyoutStack() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const rightFlyout = useViewerStore((s) => s.rightFlyout);
  const setRightFlyout = useViewerStore((s) => s.setRightFlyout);

  if (!pdfUrl) return null;

  const open = rightFlyout != null;

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close side panel"
          className="no-print absolute inset-0 z-[35] bg-slate-950/50 backdrop-blur-[1px] transition-opacity duration-200"
          onClick={() => setRightFlyout(null)}
        />
      ) : null}
      <div
        className={`no-print pointer-events-none absolute inset-y-0 right-0 z-[36] flex w-[min(100%,${FLYOUT_W}px)] max-w-full flex-col shadow-none transition-transform duration-300 ease-out print:hidden ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        style={{ width: FLYOUT_W }}
        aria-hidden={!open}
      >
        <div className="pointer-events-auto flex h-full min-h-0 flex-col border-l border-[#334155] bg-[#0F172A]">
          {rightFlyout === "settings" ? (
            <FlyoutChrome title="Sheet settings" onClose={() => setRightFlyout(null)}>
              <div className="flex flex-col">
                <MapSnapPanelBody />
                <hr className="mx-3 border-0 border-t border-[#334155]" />
                <SettingsFlyoutBody />
              </div>
            </FlyoutChrome>
          ) : null}
        </div>
      </div>
    </>
  );
}

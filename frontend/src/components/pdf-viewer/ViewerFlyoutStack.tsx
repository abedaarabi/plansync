"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";
import { DEFAULT_SHEET_OVERLAY_VISIBILITY } from "@/lib/viewerSheetOverlay";
import { MapSnapPanelBody } from "./ViewerRightPanel";
import { IssuePanelHost } from "./IssuePanelHost";

const SETTINGS_FLYOUT_W = 300;
const ISSUE_FLYOUT_W = 340;

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
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 shadow-[-8px_0_20px_-8px_rgba(12,18,34,0.1)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <h2 className="truncate text-[12px] font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function SettingsFlyoutBody() {
  const sheetOverlayVisibility = useViewerStore((s) => s.sheetOverlayVisibility);
  const patchSheetOverlayVisibility = useViewerStore((s) => s.patchSheetOverlayVisibility);
  const setSheetOverlayVisibilityAll = useViewerStore((s) => s.setSheetOverlayVisibilityAll);

  return (
    <div className="space-y-4 overflow-y-auto px-3 py-3 text-[11px] text-slate-700 [scrollbar-width:thin]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Sheet overlays
      </p>
      <p className="text-[10px] leading-snug text-slate-500">
        Choose what appears on the drawing (same options as in this settings panel).
      </p>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
        {(
          [
            ["showMarkups", "Markups and comments"],
            ["showMeasurements", "Measurements"],
            ["showIssuePins", "Issues"],
            ["showAssetPins", "Asset pins"],
            ["showTakeoff", "Quantity takeoff"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100/80"
          >
            <input
              type="checkbox"
              className="rounded border-slate-200 bg-white text-[#2563EB] accent-[#2563EB]"
              checked={sheetOverlayVisibility[key]}
              onChange={(e) => patchSheetOverlayVisibility({ [key]: e.target.checked })}
            />
            <span className="text-slate-700">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-100"
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
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-100"
          onClick={() => setSheetOverlayVisibilityAll({ ...DEFAULT_SHEET_OVERLAY_VISIBILITY })}
        >
          Show all overlays
        </button>
      </div>
    </div>
  );
}

/**
 * Slides in from the right: sheet settings, or docked issue panel.
 */
export function ViewerFlyoutStack() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const rightFlyout = useViewerStore((s) => s.rightFlyout);
  const setRightFlyout = useViewerStore((s) => s.setRightFlyout);
  const closeIssueFlyout = useViewerStore((s) => s.closeIssueFlyout);

  if (!pdfUrl) return null;

  const open = rightFlyout != null;
  const flyoutW = rightFlyout === "issue" ? ISSUE_FLYOUT_W : SETTINGS_FLYOUT_W;
  const lightBackdrop = rightFlyout === "issue";

  const onClose = () => {
    if (rightFlyout === "issue") closeIssueFlyout();
    else setRightFlyout(null);
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close side panel"
          className={`no-print absolute inset-0 z-[35] transition-opacity duration-200 ${
            lightBackdrop ? "bg-transparent" : "bg-slate-50 backdrop-blur-[1px]"
          }`}
          onClick={onClose}
        />
      ) : null}
      <div
        className={`no-print pointer-events-none absolute inset-y-0 right-0 z-[36] flex max-w-full flex-col shadow-none transition-transform duration-300 ease-out print:hidden ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        style={{ width: flyoutW }}
        aria-hidden={!open}
      >
        <div className="pointer-events-auto flex h-full min-h-0 flex-col border-l border-slate-200 bg-white">
          {rightFlyout === "settings" ? (
            <FlyoutChrome title="Sheet settings" onClose={onClose}>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <MapSnapPanelBody />
                <hr className="mx-3 border-0 border-t border-slate-200" />
                <SettingsFlyoutBody />
              </div>
            </FlyoutChrome>
          ) : null}
          {rightFlyout === "issue" ? (
            <FlyoutChrome title="Issue details" onClose={onClose}>
              <IssuePanelHost />
            </FlyoutChrome>
          ) : null}
        </div>
      </div>
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { Layers, Magnet, Map } from "lucide-react";
import { getActiveSnapPresetId, SNAP_PRESETS } from "@/lib/snapPresets";
import { useViewerStore } from "@/store/viewerStore";
import { BookmarkViews } from "./BookmarkViews";

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {children}
    </h3>
  );
}

function PillToggle({
  pressed,
  onPressedChange,
  disabled,
  id,
  label,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
  id: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={pressed}
      disabled={disabled}
      data-state={pressed ? "on" : "off"}
      onClick={() => onPressedChange(!pressed)}
      className="viewer-pill-toggle shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="viewer-pill-toggle-thumb" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Map, saved views, and snap — used inside the right settings flyout (navy chrome).
 */
export function MapSnapPanelBody() {
  const snapToGeometry = useViewerStore((s) => s.snapToGeometry);
  const snapRadiusPx = useViewerStore((s) => s.snapRadiusPx);
  const snapLayerIds = useViewerStore((s) => s.snapLayerIds);
  const pdfSnapLayers = useViewerStore((s) => s.pdfSnapLayers);
  const showMinimap = useViewerStore((s) => s.showMinimap);
  const setShowMinimap = useViewerStore((s) => s.setShowMinimap);
  const minimapOnlyWhenZoomed = useViewerStore((s) => s.minimapOnlyWhenZoomed);
  const setMinimapOnlyWhenZoomed = useViewerStore((s) => s.setMinimapOnlyWhenZoomed);
  const setSnapToGeometry = useViewerStore((s) => s.setSnapToGeometry);
  const setSnapRadiusPx = useViewerStore((s) => s.setSnapRadiusPx);
  const setSnapLayerIds = useViewerStore((s) => s.setSnapLayerIds);
  const setToolbarHoveredLayerId = useViewerStore((s) => s.setToolbarHoveredLayerId);

  const allLayerIds = pdfSnapLayers.map((l) => l.id);

  const toggleSnapLayer = (id: string) => {
    if (snapLayerIds === null) {
      const next = allLayerIds.filter((x) => x !== id);
      setSnapLayerIds(next);
      return;
    }
    const set = new Set(snapLayerIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = [...set];
    if (next.length === 0) setSnapLayerIds(null);
    else if (next.length === allLayerIds.length) setSnapLayerIds(null);
    else setSnapLayerIds(next);
  };

  const layerSnapActive = (id: string) =>
    snapLayerIds === null || snapLayerIds.length === 0 || snapLayerIds.includes(id);

  const activeSnapPreset = getActiveSnapPresetId(snapToGeometry, snapRadiusPx);

  const applySnapPreset = (p: (typeof SNAP_PRESETS)[number]) => {
    setSnapToGeometry(p.snap);
    setSnapRadiusPx(p.radius);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3 text-slate-900 [scrollbar-width:thin]">
      <SectionTitle>Map</SectionTitle>
      <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Map className="h-4 w-4 shrink-0 text-[var(--viewer-primary)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-tight text-slate-900">Overview map</p>
              <p className="text-[9px] leading-snug text-slate-500">Corner thumbnail for panning</p>
            </div>
          </div>
          <PillToggle
            id="minimap-toggle"
            label="Toggle overview map"
            pressed={showMinimap}
            onPressedChange={setShowMinimap}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <span className="text-[10px] font-medium tracking-tight text-slate-500">
            Only when zoomed in
          </span>
          <PillToggle
            id="minimap-zoom-toggle"
            label="Show minimap only when zoomed past 100%"
            pressed={minimapOnlyWhenZoomed}
            onPressedChange={setMinimapOnlyWhenZoomed}
            disabled={!showMinimap}
          />
        </div>
      </div>

      <SectionTitle>Saved views</SectionTitle>
      <div className="mb-4 [&_.viewer-card]:border-slate-200 [&_.viewer-card]:bg-white">
        <BookmarkViews />
      </div>

      <SectionTitle>Snap to sheet</SectionTitle>
      <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Magnet className="h-4 w-4 shrink-0 text-[var(--viewer-primary)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-tight text-slate-900">PDF geometry</p>
              <p className="text-[9px] leading-snug text-slate-500">Snap strokes to vectors</p>
            </div>
          </div>
          <PillToggle
            id="snap-geometry"
            label="Toggle snap to PDF geometry"
            pressed={snapToGeometry}
            onPressedChange={setSnapToGeometry}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Strength
          </p>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {SNAP_PRESETS.map((p) => {
              const active = activeSnapPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.id === "off" ? "Turn off snap" : `Snap on, ${p.radius}px search radius`}
                  onClick={() => applySnapPreset(p)}
                  className={`min-w-0 flex-1 rounded-md px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition ${
                    active
                      ? "bg-[var(--viewer-primary-muted)] text-[var(--viewer-primary)] ring-1 ring-[var(--viewer-primary)]/45"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {activeSnapPreset === "custom" && snapToGeometry && (
            <p className="mt-2 text-[9px] leading-snug text-slate-500">
              Custom radius — adjust the slider below.
            </p>
          )}
        </div>

        <label
          className="block border-t border-slate-200 pt-3 text-[10px] text-slate-500"
          title="Search radius in pixels (0 = no snap)."
        >
          <span className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-medium text-slate-700">Snap radius</span>
            <span className="tabular-nums text-[var(--viewer-primary)]">{snapRadiusPx}px</span>
          </span>
          <input
            type="range"
            min={0}
            max={48}
            value={snapRadiusPx}
            onChange={(e) => setSnapRadiusPx(Number(e.target.value))}
            className="viewer-range w-full"
            disabled={!snapToGeometry}
            title="Snap search radius in pixels"
          />
        </label>

        {pdfSnapLayers.length >= 1 && snapToGeometry && (
          <div className="max-h-32 space-y-2 overflow-y-auto border-t border-slate-200 pt-3 text-[10px]">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <Layers className="h-3.5 w-3.5 text-[var(--viewer-primary)]" />
              Layers
            </p>
            {pdfSnapLayers.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-md px-0.5 py-1 hover:bg-slate-100/50"
                onMouseEnter={() => setToolbarHoveredLayerId(l.id)}
                onMouseLeave={() => setToolbarHoveredLayerId(null)}
              >
                <span className="min-w-0 truncate text-[10px] text-slate-700" title={l.label}>
                  {l.label}
                </span>
                <PillToggle
                  id={`layer-${l.id}`}
                  label={`Toggle snap for ${l.label}`}
                  pressed={layerSnapActive(l.id)}
                  onPressedChange={() => toggleSnapLayer(l.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] italic leading-snug text-slate-500">
        Saved views store zoom, page, and snap. Pan and zoom use the top toolbar.
      </p>
    </div>
  );
}

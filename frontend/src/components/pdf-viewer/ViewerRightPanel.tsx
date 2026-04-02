"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Layers, Magnet, Map } from "lucide-react";
import { getActiveSnapPresetId, SNAP_PRESETS } from "@/lib/snapPresets";
import { useViewerStore } from "@/store/viewerStore";
import { BookmarkViews } from "./BookmarkViews";

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--viewer-text-muted)]">
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
 * Map, saved views, and snap — secondary tools so the left sidebar stays focused on markup.
 */
export function ViewerRightPanel() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const rightSidebarOpen = useViewerStore((s) => s.rightSidebarOpen);
  const setRightSidebarOpen = useViewerStore((s) => s.setRightSidebarOpen);
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

  if (!pdfUrl) return null;

  return (
    <aside
      className={`no-print flex h-full shrink-0 flex-col overflow-hidden border-l border-[#334155] bg-[#0F172A] text-[#F8FAFC] shadow-[inset_1px_0_0_0_rgba(51,65,85,0.5)] transition-[width] duration-200 ease-out ${
        rightSidebarOpen ? "w-[220px] max-w-[240px]" : "w-9"
      }`}
      aria-label="Map and snap"
    >
      {!rightSidebarOpen ? (
        <button
          type="button"
          onClick={() => setRightSidebarOpen(true)}
          className="group flex min-h-0 flex-1 items-center justify-center px-px transition"
          title="Show map & snap"
          aria-expanded="false"
          aria-label="Open map and snap panel"
        >
          <span className="flex h-9 w-8 max-w-full items-center justify-center rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] shadow-sm transition group-hover:border-[#475569] group-hover:bg-[#334155] group-hover:text-[#F8FAFC]">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
        </button>
      ) : (
        <>
          <div className="flex shrink-0 items-start justify-between gap-1 border-b border-[#334155] px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                Map &amp; snap
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-tight tracking-tight text-[#F8FAFC]">
                Navigation &amp; precision
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRightSidebarOpen(false)}
              className="viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--viewer-border-strong)]/80 bg-[color-mix(in_srgb,var(--viewer-input-bg)_90%,transparent)] text-[var(--viewer-text-muted)] transition hover:border-[var(--viewer-primary)]/35 hover:bg-[var(--viewer-input-bg)] hover:text-[var(--viewer-text)]"
              title="Hide panel"
              aria-expanded="true"
              aria-label="Close map and snap panel"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2.5 py-2 [scrollbar-width:thin]">
            <SectionTitle>Map</SectionTitle>
            <div className="viewer-card mb-4 space-y-3 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Map className="h-4 w-4 shrink-0 text-[var(--viewer-primary)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-tight text-[var(--viewer-text)]">
                      Overview map
                    </p>
                    <p className="text-[9px] leading-snug text-[var(--viewer-text-muted)]">
                      Corner thumbnail for panning
                    </p>
                  </div>
                </div>
                <PillToggle
                  id="minimap-toggle"
                  label="Toggle overview map"
                  pressed={showMinimap}
                  onPressedChange={setShowMinimap}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--viewer-border-strong)]/60 pt-3">
                <span className="text-[10px] font-medium tracking-tight text-[var(--viewer-text-muted)]">
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
            <BookmarkViews />

            <SectionTitle>Snap to sheet</SectionTitle>
            <div className="viewer-card mb-4 space-y-3 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Magnet className="h-4 w-4 shrink-0 text-[var(--viewer-primary)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-tight text-[var(--viewer-text)]">
                      PDF geometry
                    </p>
                    <p className="text-[9px] leading-snug text-[var(--viewer-text-muted)]">
                      Snap strokes to vectors
                    </p>
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
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--viewer-text-muted)]">
                  Strength
                </p>
                <div className="flex rounded-lg border border-[var(--viewer-border-strong)] bg-[color-mix(in_srgb,var(--viewer-input-bg)_80%,transparent)] p-0.5">
                  {SNAP_PRESETS.map((p) => {
                    const active = activeSnapPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={
                          p.id === "off" ? "Turn off snap" : `Snap on, ${p.radius}px search radius`
                        }
                        onClick={() => applySnapPreset(p)}
                        className={`min-w-0 flex-1 rounded-md px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition ${
                          active
                            ? "bg-[var(--viewer-primary)] text-white shadow-[var(--viewer-primary-glow)]"
                            : "text-[var(--viewer-text-muted)] hover:bg-[var(--viewer-input-bg)] hover:text-[var(--viewer-text)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {activeSnapPreset === "custom" && snapToGeometry && (
                  <p className="mt-2 text-[9px] leading-snug text-[var(--viewer-text-muted)]">
                    Custom radius — adjust the slider below.
                  </p>
                )}
              </div>

              <label
                className="block border-t border-[var(--viewer-border-strong)]/60 pt-3 text-[10px] text-[var(--viewer-text-muted)]"
                title="Search radius in pixels (0 = no snap)."
              >
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--viewer-text)]">Snap radius</span>
                  <span className="tabular-nums text-[var(--viewer-primary)]">
                    {snapRadiusPx}px
                  </span>
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
                <div className="max-h-32 space-y-2 overflow-y-auto border-t border-[var(--viewer-border-strong)]/60 pt-3 text-[10px]">
                  <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--viewer-text-muted)]">
                    <Layers className="h-3.5 w-3.5 text-[var(--viewer-primary)]" />
                    Layers
                  </p>
                  {pdfSnapLayers.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-2 rounded-md px-0.5 py-1 hover:bg-[color-mix(in_srgb,var(--viewer-input-bg)_80%,transparent)]"
                      onMouseEnter={() => setToolbarHoveredLayerId(l.id)}
                      onMouseLeave={() => setToolbarHoveredLayerId(null)}
                    >
                      <span
                        className="min-w-0 truncate text-[10px] text-[var(--viewer-text-muted)]"
                        title={l.label}
                      >
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

            <p className="rounded-lg border border-[var(--viewer-border-strong)]/70 bg-[color-mix(in_srgb,var(--viewer-input-bg)_45%,transparent)] px-2 py-2 text-[9px] italic leading-snug text-[var(--viewer-text-muted)]">
              Saved views store zoom, page, and snap. Pan and zoom use the top toolbar.
            </p>
          </div>
        </>
      )}
    </aside>
  );
}

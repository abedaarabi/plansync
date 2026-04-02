"use client";

import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Info,
  LayoutGrid,
  Minus,
  Ruler,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { computeTakeoffAnomalies } from "@/lib/takeoffAnomalies";
import { combineCountRedrawPoints, patchZoneQuantitiesFromPoints } from "@/lib/takeoffCompute";
import { TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import { useViewerStore } from "@/store/viewerStore";
import type { TakeoffMeasurementType } from "@/lib/takeoffTypes";
const DRAW_TYPES: {
  id: TakeoffMeasurementType;
  label: string;
  icon: typeof Square;
}[] = [
  { id: "area", label: "Area", icon: Square },
  { id: "linear", label: "Linear", icon: Minus },
  { id: "count", label: "Count", icon: CircleDot },
];

function PanelSection({
  title,
  children,
  className = "",
  titleRight,
  bodyClassName = "mt-2.5",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  titleRight?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-700/80 bg-slate-900/35 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-tight text-slate-200">{title}</h3>
        {titleRight}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SidebarTakeoffTab() {
  const tool = useViewerStore((s) => s.tool);
  const setTool = useViewerStore((s) => s.setTool);
  const currentPage = useViewerStore((s) => s.currentPage);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const takeoffDrawKind = useViewerStore((s) => s.takeoffDrawKind);
  const setTakeoffDrawKind = useViewerStore((s) => s.setTakeoffDrawKind);
  const takeoffAreaMode = useViewerStore((s) => s.takeoffAreaMode);
  const setTakeoffAreaMode = useViewerStore((s) => s.setTakeoffAreaMode);
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const openTakeoffSlider = useViewerStore((s) => s.openTakeoffSlider);
  const takeoffUpdateZone = useViewerStore((s) => s.takeoffUpdateZone);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const takeoffPenColor = useViewerStore((s) => s.takeoffPenColor);
  const setTakeoffPenColor = useViewerStore((s) => s.setTakeoffPenColor);
  const takeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.takeoffInventoryDrawerFromSidebar,
  );
  const setTakeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.setTakeoffInventoryDrawerFromSidebar,
  );

  const pageIdx0 = currentPage - 1;
  const cal = calibrationByPage[pageIdx0];
  const sz = pageSizePtByPage[pageIdx0];

  const pageSizeMap = useMemo(() => {
    const m: Record<number, { w: number; h: number }> = {};
    for (const [k, v] of Object.entries(pageSizePtByPage)) {
      m[Number(k)] = { w: v.wPt, h: v.hPt };
    }
    return m;
  }, [pageSizePtByPage]);

  const anomalies = useMemo(
    () => computeTakeoffAnomalies(takeoffZones, pageSizeMap),
    [takeoffZones, pageSizeMap],
  );

  const takeoffCountDraftPoints = useViewerStore((s) => s.takeoffCountDraftPoints);
  const takeoffRedrawZoneId = useViewerStore((s) => s.takeoffRedrawZoneId);

  const countRedrawActive = useMemo(() => {
    if (!takeoffRedrawZoneId) return false;
    const z = takeoffZones.find((x) => x.id === takeoffRedrawZoneId);
    return Boolean(z && z.measurementType === "count" && z.pageIndex === pageIdx0 && !z.locked);
  }, [takeoffRedrawZoneId, takeoffZones, pageIdx0]);

  const finishCountFromStore = (countRedrawMode?: "merge" | "replace") => {
    const pts = useViewerStore.getState().takeoffCountDraftPoints;
    if (!pts?.length) {
      toast.error("Place at least one count point on the sheet.");
      return;
    }
    if (!cal || !sz) return;
    const st = useViewerStore.getState();
    const rid = st.takeoffRedrawZoneId;
    if (rid) {
      const z = st.takeoffZones.find((x) => x.id === rid);
      const item = z ? st.takeoffItems.find((i) => i.id === z.itemId) : undefined;
      if (!z || !item || z.locked || z.pageIndex !== pageIdx0 || z.measurementType !== "count") {
        st.setTakeoffRedrawZoneId(null);
        toast.error("Could not redraw this zone. Finishing as a new count instead.");
        openTakeoffSlider({
          pending: {
            kind: "count",
            pageIndex: pageIdx0,
            points: pts.map((p) => ({ ...p })),
            rawQuantity: pts.length,
            computedQuantity: pts.length,
          },
        });
        st.setTakeoffCountDraftPoints(null);
        return;
      }
      const mode = countRedrawMode ?? "merge";
      const geomPoints = combineCountRedrawPoints(z.points, pts, mode);
      const { points, rawQuantity, computedQuantity } = patchZoneQuantitiesFromPoints(
        z,
        item,
        geomPoints,
        sz.wPt,
        sz.hPt,
        cal.mmPerPdfUnit,
      );
      takeoffUpdateZone(rid, { points, rawQuantity, computedQuantity });
      st.setTakeoffRedrawZoneId(null);
      st.setTakeoffCountDraftPoints(null);
      toast.success(
        mode === "replace" ? "Count marks replaced." : "New marks added to this count zone.",
      );
      openTakeoffSlider({ editZoneId: rid });
      return;
    }
    openTakeoffSlider({
      pending: {
        kind: "count",
        pageIndex: pageIdx0,
        points: pts.map((p) => ({ ...p })),
        rawQuantity: pts.length,
        computedQuantity: pts.length,
      },
    });
    useViewerStore.getState().setTakeoffCountDraftPoints(null);
  };

  if (!cloudFileVersionId || !viewerProjectId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center p-1">
        <div className="rounded-xl border border-slate-600/60 bg-slate-900/50 p-4 text-[12px] leading-relaxed text-slate-400">
          <p className="font-semibold text-slate-200">Takeoff needs a project file</p>
          <p className="mt-2">
            Open this sheet from a cloud project to use quantity takeoff, inventory, and exports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] px-0.5 pb-1 pt-0.5">
        <PanelSection title="Scale">
          {!cal ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-[11px] leading-snug text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Calibrate this sheet in the <strong className="font-medium">Measure</strong> tab
                first.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-emerald-200/95">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="tabular-nums">
                Ready · {cal.mmPerPdfUnit.toExponential(2)} mm per PDF unit
              </span>
            </div>
          )}
        </PanelSection>

        <PanelSection
          title="Line color"
          bodyClassName="mt-1"
          titleRight={
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800/80 hover:text-slate-300"
              title="Preview on the sheet and default for new lines until you pick a row in inventory."
              aria-label="Line color help"
            >
              <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {TAKEOFF_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className={`h-6 w-6 shrink-0 rounded-full border-2 transition-shadow ${
                  takeoffPenColor === c
                    ? "border-transparent ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0c1220]"
                    : "border-transparent hover:ring-1 hover:ring-slate-600"
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setTakeoffPenColor(c)}
              />
            ))}
            <input
              type="color"
              value={takeoffPenColor}
              onChange={(e) => setTakeoffPenColor(e.target.value)}
              className="h-6 w-9 cursor-pointer rounded-md border border-slate-600 bg-transparent"
            />
          </div>
        </PanelSection>

        <PanelSection
          title="Draw"
          bodyClassName="mt-2.5 flex flex-col"
          titleRight={
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800/80 hover:text-slate-300"
              title={
                "Click a zone to edit. Use inventory (below the sheet) for rows, export, and multi-select. " +
                "⌘/Ctrl-click zones on the sheet to add or remove from selection."
              }
              aria-label="Takeoff drawing help"
            >
              <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-1.5">
            {DRAW_TYPES.map((d) => {
              const Icon = d.icon;
              const active = takeoffDrawKind === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={!cal}
                  onClick={() => {
                    setTakeoffDrawKind(d.id);
                    setTool("takeoff");
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                    active
                      ? "border-sky-500/55 bg-sky-600/25 text-sky-50 shadow-sm ring-1 ring-sky-500/30"
                      : "border-slate-600/80 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:bg-slate-800/70 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {d.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!cal}
            onClick={() => setTool("takeoff")}
            className={`mt-3 inline-flex max-w-[min(100%,16rem)] items-center justify-center gap-2 self-center rounded-lg px-4 py-2 text-[12px] font-semibold shadow-sm transition-[box-shadow,transform] duration-200 disabled:opacity-40 ${
              tool === "takeoff"
                ? "bg-sky-500 text-white ring-2 ring-sky-300/50 ring-offset-2 ring-offset-[#0c1220] animate-[takeoff-draw-pulse_2.2s_ease-in-out_infinite]"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}
          >
            <Ruler className="h-4 w-4 shrink-0" />
            {tool === "takeoff" ? "Drawing..." : "Start drawing on sheet"}
          </button>

          {takeoffDrawKind === "area" ? (
            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <p className="text-[10px] font-medium text-slate-400">Area shape</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!cal}
                  onClick={() => {
                    setTakeoffAreaMode("polygon");
                    setTool("takeoff");
                  }}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                    takeoffAreaMode === "polygon"
                      ? "border-sky-500/55 bg-sky-600/25 text-sky-50 ring-1 ring-sky-500/30"
                      : "border-slate-600/80 bg-slate-800/40 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  Polygon
                </button>
                <button
                  type="button"
                  disabled={!cal}
                  onClick={() => {
                    setTakeoffAreaMode("box");
                    setTool("takeoff");
                  }}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                    takeoffAreaMode === "box"
                      ? "border-sky-500/55 bg-sky-600/25 text-sky-50 ring-1 ring-sky-500/30"
                      : "border-slate-600/80 bg-slate-800/40 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  Box (2 clicks)
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                {takeoffAreaMode === "box"
                  ? "Two opposite corners. Hold Shift for horizontal or vertical alignment."
                  : "Click corners; click near start or press Enter to close."}
              </p>
            </div>
          ) : null}
        </PanelSection>

        {anomalies.length > 0 ? (
          <PanelSection title="Checks" className="border-sky-800/40 bg-sky-950/20">
            <ul className="space-y-1.5 text-[10px] leading-snug text-sky-100/90">
              {anomalies.slice(0, 5).map((a) => (
                <li key={a.id} className="flex gap-1.5">
                  <LayoutGrid className="mt-0.5 h-3 w-3 shrink-0 text-sky-400" />
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          </PanelSection>
        ) : null}

        <PanelSection title="Inventory panel">
          {takeoffInventoryDrawerFromSidebar ? (
            <p className="text-[10px] leading-relaxed text-slate-500">
              Open the drawer under the sheet to manage lines, zones, and exports. Drag the handle
              to resize.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] leading-relaxed text-slate-500">
                The bottom bar is hidden for a cleaner canvas.
              </p>
              <button
                type="button"
                onClick={() => setTakeoffInventoryDrawerFromSidebar(true)}
                className="w-full rounded-lg border border-sky-500/40 bg-sky-950/30 py-2 text-[11px] font-semibold text-sky-100 hover:bg-sky-950/50"
              >
                Show inventory
              </button>
            </div>
          )}
        </PanelSection>

        {takeoffDrawKind === "count" && tool === "takeoff" ? (
          countRedrawActive ? (
            <PanelSection title="Count redraw">
              <p className="mb-2 text-[10px] text-slate-500">
                Add appends new marks. Replace clears previous marks in this zone.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => finishCountFromStore("merge")}
                  className="rounded-lg border border-emerald-500/45 bg-emerald-950/40 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/65"
                >
                  Add to zone ({takeoffCountDraftPoints?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => finishCountFromStore("replace")}
                  className="rounded-lg border border-amber-500/40 bg-amber-950/35 py-2 text-[11px] font-semibold text-amber-100 hover:bg-amber-950/55"
                >
                  Replace all ({takeoffCountDraftPoints?.length ?? 0})
                </button>
              </div>
            </PanelSection>
          ) : (
            <button
              type="button"
              onClick={() => finishCountFromStore()}
              className="shrink-0 rounded-lg border border-emerald-500/45 bg-emerald-950/40 py-2.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/65"
            >
              Finish count ({takeoffCountDraftPoints?.length ?? 0}) and save
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

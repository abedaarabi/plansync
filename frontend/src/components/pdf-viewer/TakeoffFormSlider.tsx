"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, MapPin, Pencil, Search, Shapes, X } from "lucide-react";
import { fetchMaterials, fetchProject, type MaterialRow } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { clamp01 } from "@/lib/coords";
import {
  applyItemToRawQuantity,
  computeRawQuantity,
  formatRawQuantityLabel,
  patchZoneQuantitiesFromPoints,
  sumZonesForItem,
} from "@/lib/takeoffCompute";
import {
  materialUnitPriceAsNumber,
  normalizeMaterialUnitToTakeoff,
} from "@/lib/takeoffMaterialMap";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";
import { TAKEOFF_FOCUS_FIT_MARGIN, takeoffFocusRectForZone } from "@/lib/takeoffFocus";
import { publishTakeoffZoneToProjectLine } from "@/lib/takeoffPublishCloud";
import { DEFAULT_TAKEOFF_COLOR, TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import { useViewerStore } from "@/store/viewerStore";
import { toast } from "sonner";

function unitsForKind(kind: TakeoffMeasurementType): TakeoffUnit[] {
  switch (kind) {
    case "area":
      return ["m²", "mm²", "ft²"];
    case "linear":
      return ["m", "mm", "ft", "kg"];
    case "count":
      return ["ea"];
    default:
      return ["m²"];
  }
}

export function TakeoffFormSlider() {
  const open = useViewerStore((s) => s.takeoffSliderOpen);
  const editZoneId = useViewerStore((s) => s.takeoffEditingZoneId);
  const pending = useViewerStore((s) => s.takeoffPendingGeometry);
  const items = useViewerStore((s) => s.takeoffItems);
  const zones = useViewerStore((s) => s.takeoffZones);
  const selectedItemId = useViewerStore((s) => s.takeoffSelectedItemId);
  const displayName = useViewerStore((s) => s.displayName);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const closeTakeoffSlider = useViewerStore((s) => s.closeTakeoffSlider);
  const takeoffAddItem = useViewerStore((s) => s.takeoffAddItem);
  const setTakeoffPenColor = useViewerStore((s) => s.setTakeoffPenColor);
  const takeoffAddZone = useViewerStore((s) => s.takeoffAddZone);
  const takeoffUpdateItem = useViewerStore((s) => s.takeoffUpdateItem);
  const takeoffUpdateZone = useViewerStore((s) => s.takeoffUpdateZone);
  const takeoffRemoveZone = useViewerStore((s) => s.takeoffRemoveZone);
  const setTakeoffDrawKind = useViewerStore((s) => s.setTakeoffDrawKind);
  const setTakeoffAreaMode = useViewerStore((s) => s.setTakeoffAreaMode);
  const setTakeoffRedrawZoneId = useViewerStore((s) => s.setTakeoffRedrawZoneId);
  const setTakeoffMoveZoneId = useViewerStore((s) => s.setTakeoffMoveZoneId);
  const setTakeoffVertexEditZoneId = useViewerStore((s) => s.setTakeoffVertexEditZoneId);
  const setTool = useViewerStore((s) => s.setTool);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);

  const { data: project } = useQuery({
    queryKey: qk.project(viewerProjectId ?? ""),
    queryFn: () => fetchProject(viewerProjectId!),
    enabled: Boolean(viewerProjectId),
  });
  const workspaceId = project?.workspaceId;
  const { data: materials = [], isPending: materialsLoading } = useQuery({
    queryKey: qk.materials(workspaceId ?? ""),
    queryFn: () => fetchMaterials(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [materialSearch, setMaterialSearch] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const editZone = useMemo(
    () => (editZoneId ? zones.find((z) => z.id === editZoneId) : undefined),
    [editZoneId, zones],
  );
  const editItem = useMemo(
    () => (editZone ? items.find((i) => i.id === editZone.itemId) : undefined),
    [editZone, items],
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<TakeoffUnit>("m²");
  const [color, setColor] = useState<string>(DEFAULT_TAKEOFF_COLOR);
  const [notes, setNotes] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [wastePct, setWastePct] = useState("");
  const [linearFactor, setLinearFactor] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (!open) return;
    setMaterialSearch("");
    setMaterialPickerOpen(false);
    if (editZone && editItem) {
      setName(editItem.name);
      setCategory(editItem.category ?? "");
      setUnit(editItem.unit);
      setColor(editItem.color);
      setNotes(editZone.notes ?? editItem.notes ?? "");
      setTagsStr(editZone.tags?.length ? editZone.tags.join(", ") : "");
      setWastePct(editItem.wastePercent != null ? String(editItem.wastePercent) : "");
      setLinearFactor(editItem.linearFactor != null ? String(editItem.linearFactor) : "");
      setRate(editItem.rate != null ? String(editItem.rate) : "");
      setSelectedMaterialId(editItem.materialId ?? null);
      return;
    }
    if (pending) {
      setName("");
      setCategory("");
      setUnit(unitsForKind(pending.kind)[0]);
      setColor(useViewerStore.getState().takeoffPenColor);
      setNotes("");
      setTagsStr("");
      setWastePct("");
      setLinearFactor("");
      setRate("");
      setSelectedMaterialId(null);
      if (selectedItemId) {
        const it = items.find((i) => i.id === selectedItemId);
        if (it) {
          setName(it.name);
          setCategory(it.category ?? "");
          setUnit(it.unit);
          setColor(it.color);
          setWastePct(it.wastePercent != null ? String(it.wastePercent) : "");
          setLinearFactor(it.linearFactor != null ? String(it.linearFactor) : "");
          setRate(it.rate != null ? String(it.rate) : "");
          setSelectedMaterialId(it.materialId ?? null);
        }
      }
    }
  }, [open, editZone, editItem, pending, selectedItemId, items]);

  const kind: TakeoffMeasurementType | null = pending?.kind ?? editZone?.measurementType ?? null;

  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);

  const selectedMaterial = useMemo(
    () => (selectedMaterialId ? materials.find((m) => m.id === selectedMaterialId) : undefined),
    [materials, selectedMaterialId],
  );

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    const list = !q
      ? materials
      : materials.filter((m) => {
          const hay = `${m.category.name} ${m.name} ${m.sku ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
    return list.slice(0, 60);
  }, [materials, materialSearch]);

  function applyMaterial(m: MaterialRow) {
    if (!kind) return;
    setSelectedMaterialId(m.id);
    setMaterialSearch("");
    setMaterialPickerOpen(false);
    setName(m.name);
    setCategory(m.category.name);
    const allowed = unitsForKind(kind);
    setUnit(normalizeMaterialUnitToTakeoff(m.unit, kind, allowed));
    const p = materialUnitPriceAsNumber(m);
    setRate(p != null ? String(p) : "");
  }

  function clearMaterialSelection() {
    setSelectedMaterialId(null);
  }

  const previewComputedQty = useMemo(() => {
    if (!pending || !kind) return null;
    const sz = pageSizePtByPage[pending.pageIndex];
    const cal = calibrationByPage[pending.pageIndex];
    if (!sz || !cal) return null;
    const raw = computeRawQuantity(kind, pending.points, sz.wPt, sz.hPt, cal.mmPerPdfUnit);
    const wasteN = wastePct.trim() ? Number(wastePct) : 0;
    const lf = linearFactor.trim() ? Number(linearFactor) : undefined;
    return applyItemToRawQuantity(
      {
        measurementType: kind,
        unit,
        wastePercent: Number.isFinite(wasteN) ? wasteN : undefined,
        linearFactor: Number.isFinite(lf) ? lf : undefined,
      },
      raw,
    );
  }, [pending, kind, pageSizePtByPage, calibrationByPage, unit, wastePct, linearFactor]);

  const rateNum = rate.trim() ? Number(rate.replace(/,/g, "")) : NaN;
  const estLineCost =
    previewComputedQty != null && Number.isFinite(rateNum) && rateNum >= 0
      ? previewComputedQty * rateNum
      : null;
  const editZoneCost =
    editZone && editItem && editItem.rate != null && Number.isFinite(editItem.rate)
      ? editZone.computedQuantity * editItem.rate
      : null;

  const startRedrawShape = useCallback(() => {
    if (!editZone || editZone.locked) return;
    setTakeoffDrawKind(editZone.measurementType);
    if (editZone.measurementType === "area") {
      const pts = editZone.points;
      if (pts.length === 4) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const axisAligned = pts.every(
          (p) =>
            (Math.abs(p.x - minX) < 1e-5 || Math.abs(p.x - maxX) < 1e-5) &&
            (Math.abs(p.y - minY) < 1e-5 || Math.abs(p.y - maxY) < 1e-5),
        );
        setTakeoffAreaMode(axisAligned ? "box" : "polygon");
      } else {
        setTakeoffAreaMode("polygon");
      }
    }
    setTakeoffRedrawZoneId(editZone.id);
    setTakeoffMoveZoneId(null);
    setTakeoffVertexEditZoneId(null);
    closeTakeoffSlider();
    setTool("takeoff");
    toast.message("Draw the new shape on the sheet. Press Esc to cancel.");
  }, [
    editZone,
    closeTakeoffSlider,
    setTakeoffAreaMode,
    setTakeoffDrawKind,
    setTakeoffMoveZoneId,
    setTakeoffRedrawZoneId,
    setTakeoffVertexEditZoneId,
    setTool,
  ]);

  const startMoveZone = useCallback(() => {
    if (!editZone || editZone.locked) return;
    setTakeoffMoveZoneId(editZone.id);
    setTakeoffVertexEditZoneId(null);
    setTakeoffRedrawZoneId(null);
    closeTakeoffSlider();
    setTool("takeoff");
    toast.message("Drag the thicker outline to reposition this zone.");
  }, [
    editZone,
    closeTakeoffSlider,
    setTakeoffMoveZoneId,
    setTakeoffRedrawZoneId,
    setTakeoffVertexEditZoneId,
    setTool,
  ]);

  const startVertexEdit = useCallback(() => {
    if (
      !editZone ||
      editZone.locked ||
      editZone.measurementType !== "area" ||
      editZone.points.length < 3
    )
      return;
    setTakeoffVertexEditZoneId(editZone.id);
    setTakeoffMoveZoneId(null);
    setTakeoffRedrawZoneId(null);
    closeTakeoffSlider();
    setTool("takeoff");
    toast.message("Drag the white handles to move corners.");
  }, [
    editZone,
    closeTakeoffSlider,
    setTakeoffVertexEditZoneId,
    setTakeoffMoveZoneId,
    setTakeoffRedrawZoneId,
    setTool,
  ]);

  const duplicateCurrentZone = useCallback(() => {
    if (!editZone || !editItem) return;
    const sz = pageSizePtByPage[editZone.pageIndex];
    const cal = calibrationByPage[editZone.pageIndex];
    if (!sz || !cal) {
      toast.error("Calibration missing for that page.");
      return;
    }
    const OFFSET = 0.008;
    const shifted = editZone.points.map((p) => ({
      x: clamp01(p.x + OFFSET),
      y: clamp01(p.y + OFFSET),
    }));
    const { points, rawQuantity, computedQuantity } = patchZoneQuantitiesFromPoints(
      editZone,
      editItem,
      shifted,
      sz.wPt,
      sz.hPt,
      cal.mmPerPdfUnit,
    );
    takeoffAddZone({
      itemId: editZone.itemId,
      pageIndex: editZone.pageIndex,
      points,
      measurementType: editZone.measurementType,
      rawQuantity,
      computedQuantity,
      createdBy: displayName,
    });
    toast.success("Zone duplicated.");
    closeTakeoffSlider();
  }, [
    editZone,
    editItem,
    pageSizePtByPage,
    calibrationByPage,
    takeoffAddZone,
    displayName,
    closeTakeoffSlider,
  ]);

  const onSave = () => {
    if (!kind) return;

    const zoneTags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24);

    if (editZone && editItem) {
      takeoffUpdateItem(editItem.id, {
        name: name.trim() || editItem.name,
        category: category.trim() || undefined,
        unit,
        color,
        notes: notes.trim() || undefined,
        wastePercent: wastePct.trim() ? Number(wastePct) : undefined,
        linearFactor: linearFactor.trim() ? Number(linearFactor) : undefined,
        rate: rate.trim() ? Number(rate.replace(/,/g, "")) : undefined,
        materialId: selectedMaterialId,
      });
      const st = useViewerStore.getState();
      const nextItem = st.takeoffItems.find((i) => i.id === editItem.id);
      if (nextItem) {
        for (const z of st.takeoffZones.filter((x) => x.itemId === nextItem.id)) {
          const computed = applyItemToRawQuantity(nextItem, z.rawQuantity);
          takeoffUpdateZone(z.id, {
            computedQuantity: computed,
            ...(z.id === editZone.id
              ? {
                  notes: notes.trim() || undefined,
                  tags: zoneTags,
                }
              : {}),
          });
        }
      }
      const stE = useViewerStore.getState();
      const zAfter = stE.takeoffZones.find((x) => x.id === editZone.id);
      const itAfter = stE.takeoffItems.find((i) => i.id === editItem.id);
      {
        const cfv = useViewerStore.getState().cloudFileVersionId;
        if (cfv && zAfter && itAfter) {
          publishTakeoffZoneToProjectLine(cfv, itAfter, zAfter);
        }
      }
      closeTakeoffSlider();
      return;
    }

    if (!pending) return;
    const sz = pageSizePtByPage[pending.pageIndex];
    if (!sz) return;

    const wasteN = wastePct.trim() ? Number(wastePct) : 0;
    const lf = linearFactor.trim() ? Number(linearFactor) : undefined;
    const rateN = rate.trim() ? Number(rate.replace(/,/g, "")) : undefined;

    let itemId = selectedItemId ?? "";
    if (!itemId || !items.some((i) => i.id === itemId)) {
      itemId = takeoffAddItem({
        name: name.trim() || "New item",
        category: category.trim() || undefined,
        unit,
        measurementType: kind,
        color,
        notes: notes.trim() || undefined,
        wastePercent: Number.isFinite(wasteN) ? wasteN : undefined,
        linearFactor: lf,
        rate: rateN,
        materialId: selectedMaterialId,
      });
    } else {
      takeoffUpdateItem(itemId, {
        name: name.trim() || "Item",
        category: category.trim() || undefined,
        unit,
        color,
        notes: notes.trim() || undefined,
        wastePercent: Number.isFinite(wasteN) ? wasteN : undefined,
        linearFactor: lf,
        rate: rateN,
        materialId: selectedMaterialId,
      });
    }

    const item = useViewerStore.getState().takeoffItems.find((i) => i.id === itemId)!;
    const cal = useViewerStore.getState().calibrationByPage[pending.pageIndex];
    if (!cal) return;
    const rawGeom = computeRawQuantity(kind, pending.points, sz.wPt, sz.hPt, cal.mmPerPdfUnit);
    const computed = applyItemToRawQuantity(item, rawGeom);

    const newZoneId = takeoffAddZone({
      itemId,
      pageIndex: pending.pageIndex,
      points: pending.points.map((p) => ({ ...p })),
      measurementType: kind,
      rawQuantity: rawGeom,
      computedQuantity: computed,
      notes: notes.trim() || undefined,
      tags: zoneTags.length ? zoneTags : undefined,
      createdBy: displayName,
    });
    const st2 = useViewerStore.getState();
    st2.setTakeoffSelectedItemId(itemId);
    st2.setTakeoffSelectedZoneIds([newZoneId]);
    const zNew = st2.takeoffZones.find((x) => x.id === newZoneId);
    if (zNew) {
      const focus = takeoffFocusRectForZone(zNew);
      st2.requestSearchFocus({
        pageNumber: focus.pageIndex0 + 1,
        rectNorm: focus.rectNorm,
        fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
      });
    }
    st2.bumpTakeoffInventoryExpand();
    const zPub = st2.takeoffZones.find((x) => x.id === newZoneId);
    const itemPub = st2.takeoffItems.find((i) => i.id === itemId);
    {
      const cfv = useViewerStore.getState().cloudFileVersionId;
      if (cfv && zPub && itemPub) {
        publishTakeoffZoneToProjectLine(cfv, itemPub, zPub);
      }
    }
    setTakeoffPenColor(color);
    closeTakeoffSlider();
  };

  if (!mounted || !open) return null;

  const panel = (
    <div
      className="no-print fixed inset-0 z-[85] flex justify-end bg-black/40 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeTakeoffSlider();
      }}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[#334155] bg-[#0f172a] shadow-2xl"
        role="dialog"
        aria-label={editZone ? "Edit takeoff zone" : "New takeoff item"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[#f8fafc]">
            {editZone ? "Takeoff zone" : "New takeoff item"}
          </h2>
          <button
            type="button"
            className="rounded-md p-1.5 text-[#94a3b8] hover:bg-[#334155] hover:text-white"
            aria-label="Close"
            onClick={() => closeTakeoffSlider()}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          {pending && !editZone ? (
            <div className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-100">
              <p className="font-semibold uppercase tracking-wide text-emerald-300/90">
                Calculated
              </p>
              <p className="mt-1 tabular-nums">
                {(() => {
                  const sz = pageSizePtByPage[pending.pageIndex];
                  const cal = calibrationByPage[pending.pageIndex];
                  if (!sz || !cal) return "—";
                  const raw = computeRawQuantity(
                    pending.kind,
                    pending.points,
                    sz.wPt,
                    sz.hPt,
                    cal.mmPerPdfUnit,
                  );
                  if (pending.kind === "area")
                    return `Area: ${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm²`;
                  if (pending.kind === "linear")
                    return `Length: ${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm`;
                  return `Count: ${pending.points.length}`;
                })()}
              </p>
            </div>
          ) : null}

          {editZone && editItem ? (
            <div className="mb-4 space-y-1 rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300">
              <p>
                Raw geometry:{" "}
                <span className="tabular-nums text-slate-100">
                  {formatRawQuantityLabel(editZone.measurementType, editZone.rawQuantity)}
                </span>
              </p>
              <p>
                This zone:{" "}
                <span className="font-semibold tabular-nums text-white">
                  {editZone.computedQuantity.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {editItem.unit}
                </span>
              </p>
              <p>
                Total (all zones):{" "}
                <span className="tabular-nums text-sky-300">
                  {sumZonesForItem(zones, editItem.id).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {editItem.unit}
                </span>
              </p>
              {editZoneCost != null ? (
                <p>
                  Est. this zone (qty × rate):{" "}
                  <span className="font-semibold tabular-nums text-amber-200/95">
                    {editZoneCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {selectedMaterial?.currency ? (
                    <span className="text-slate-400"> {selectedMaterial.currency}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {editZone && editItem ? (
            <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-950/45 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/90">
                This zone on sheet
              </p>
              <p className="mt-1 text-[10px] text-amber-100/85">
                Page {editZone.pageIndex + 1}
                {editZone.locked ? " · locked" : ""}
              </p>
              {!editZone.locked ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => startRedrawShape()}
                    className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/60 px-2 py-1.5 text-left text-[11px] font-medium text-amber-50 hover:bg-amber-950/90"
                  >
                    <Shapes className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Redraw shape on sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => startMoveZone()}
                    className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/60 px-2 py-1.5 text-left text-[11px] font-medium text-amber-50 hover:bg-amber-950/90"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Move zone on sheet
                  </button>
                  {editZone.measurementType === "area" && editZone.points.length >= 3 ? (
                    <button
                      type="button"
                      onClick={() => startVertexEdit()}
                      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/60 px-2 py-1.5 text-left text-[11px] font-medium text-amber-50 hover:bg-amber-950/90"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      Edit polygon corners
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => duplicateCurrentZone()}
                    className="flex items-center gap-2 rounded-md border border-slate-500/40 bg-slate-900/70 px-2 py-1.5 text-left text-[11px] font-medium text-slate-100 hover:bg-slate-800/90"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Duplicate zone (offset copy)
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-950/40 px-3 py-2.5">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-sky-300/90">
              {editZone && editItem ? "Material & costing (line item)" : "Material library"}
            </p>
            {!workspaceId ? (
              <p className="text-[11px] leading-snug text-[#94a3b8]">
                Open this sheet from a cloud project to load your workspace material catalog.
              </p>
            ) : materialsLoading ? (
              <p className="text-[11px] text-[#64748b]">Loading materials…</p>
            ) : (
              <>
                <div className="relative">
                  <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                    <Search className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                  <input
                    type="search"
                    value={materialSearch}
                    onChange={(e) => {
                      setMaterialSearch(e.target.value);
                      setMaterialPickerOpen(true);
                    }}
                    onFocus={() => setMaterialPickerOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setMaterialPickerOpen(false), 180);
                    }}
                    placeholder="Search materials (e.g. door, concrete)…"
                    autoComplete="off"
                    className="w-full rounded-md border border-[#475569] bg-[#0f172a] py-2 pl-8 pr-2 text-[12px] text-[#f8fafc] placeholder:text-[#64748b]"
                  />
                  {materialPickerOpen && filteredMaterials.length > 0 ? (
                    <ul
                      className="absolute left-0 right-0 top-full z-[1] mt-1 max-h-44 overflow-y-auto rounded-md border border-[#334155] bg-[#0f172a] py-1 shadow-lg [scrollbar-width:thin]"
                      role="listbox"
                    >
                      {filteredMaterials.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-[#1e293b]"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyMaterial(m)}
                          >
                            <span className="font-medium text-[#f8fafc]">{m.name}</span>
                            <span className="block text-[10px] text-[#94a3b8]">
                              {m.category.name}
                              {m.sku ? ` · ${m.sku}` : ""}
                              {m.unitPrice != null && m.unitPrice !== ""
                                ? ` · ${m.currency} ${m.unitPrice}/${m.unit}`
                                : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {selectedMaterial ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-emerald-300">
                      Linked: {selectedMaterial.category.name} — {selectedMaterial.name}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-[#475569] px-2 py-0.5 text-[10px] text-[#94a3b8] hover:bg-[#334155]"
                      onClick={() => clearMaterialSelection()}
                    >
                      Unlink
                    </button>
                  </div>
                ) : null}
                {materials.length === 0 ? (
                  <p className="mt-2 text-[10px] leading-snug text-amber-200/90">
                    No materials in this workspace yet. Add them in the material hub, then search
                    here.
                  </p>
                ) : null}
              </>
            )}
          </div>

          {pending && estLineCost != null && previewComputedQty != null ? (
            <div className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-100">
              <p className="font-semibold uppercase tracking-wide text-emerald-300/90">
                Estimated line cost
              </p>
              <p className="mt-1 tabular-nums">
                {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}{" "}
                × {rateNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} ={" "}
                <span className="font-semibold text-white">
                  {estLineCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {selectedMaterial?.currency ? (
                  <span className="text-emerald-200/80"> {selectedMaterial.currency}</span>
                ) : null}
              </p>
            </div>
          ) : null}

          {editZone && editItem ? (
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
              Line item (all zones for this item)
            </p>
          ) : null}

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Item name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              placeholder="e.g. Concrete slab"
            />
          </label>

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Category (optional)
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              placeholder="Structure"
            />
          </label>

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Unit
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as TakeoffUnit)}
              disabled={Boolean(selectedItemId && !editZone)}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc] disabled:opacity-50"
            >
              {(kind ? unitsForKind(kind) : ["m²"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          {kind === "linear" ? (
            <label className="mb-3 block text-[11px] text-[#94a3b8]">
              Linear factor (kg/m) — when unit is kg
              <input
                value={linearFactor}
                onChange={(e) => setLinearFactor(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
                placeholder="Optional"
              />
            </label>
          ) : null}

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Waste %
            <input
              value={wastePct}
              onChange={(e) => setWastePct(e.target.value.replace(/[^\d.]/g, ""))}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              placeholder="0"
            />
          </label>

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span>Unit price / rate</span>
              {selectedMaterial ? (
                <span className="text-[10px] font-normal text-emerald-400/90">(from catalog)</span>
              ) : (
                <span className="text-[10px] font-normal text-[#64748b]">(optional)</span>
              )}
            </span>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              placeholder="Per display unit"
            />
          </label>

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Tags (comma-separated, e.g. Floor 1, MEP)
            <input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              placeholder="Optional"
            />
          </label>

          <label className="mb-3 block text-[11px] text-[#94a3b8]">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
            />
          </label>

          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
            Color
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {TAKEOFF_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className={`h-8 w-8 rounded-full border-2 ${
                  color === c ? "border-white ring-2 ring-sky-500/50" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[#475569] bg-transparent"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#334155] px-4 py-3">
          {editZone ? (
            <button
              type="button"
              className="mr-auto rounded-md border border-red-900/60 bg-red-950/50 px-3 py-2 text-[11px] font-medium text-red-200 hover:bg-red-950/80"
              onClick={() => {
                if (editZoneId) takeoffRemoveZone(editZoneId);
                closeTakeoffSlider();
              }}
            >
              Delete zone
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-[#475569] px-4 py-2 text-[11px] font-medium text-[#e2e8f0] hover:bg-[#334155]"
            onClick={() => closeTakeoffSlider()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#2563eb] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-40"
            disabled={!editZone && !pending}
            onClick={() => onSave()}
          >
            {editZone ? "Save" : "Save item"}
          </button>
        </div>
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}

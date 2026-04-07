"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, MapPin, Pencil, Search, Shapes, X } from "lucide-react";
import {
  fetchMaterials,
  fetchMaterialTemplate,
  fetchProject,
  type MaterialRow,
  type MaterialTemplate,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { clamp01 } from "@/lib/coords";
import {
  applyItemToRawQuantity,
  computeRawQuantity,
  formatRawQuantityLabel,
  patchZoneQuantitiesFromPoints,
  rawToDisplayUnit,
  sumZonesForItem,
} from "@/lib/takeoffCompute";
import {
  materialUnitPriceAsNumber,
  normalizeMaterialUnitToTakeoff,
} from "@/lib/takeoffMaterialMap";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";

type HeightInputUnit = "m" | "mm" | "ft";

function heightMmFromInput(value: string, u: HeightInputUnit): number | undefined {
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (u === "m") return n * 1000;
  if (u === "mm") return n;
  return n * 304.8;
}

function formatHeightMmForUnit(mm: number, u: HeightInputUnit): string {
  if (u === "mm") return String(Math.round(mm));
  const v = mm / (u === "m" ? 1000 : 304.8);
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(8)));
}
import { TAKEOFF_FOCUS_FIT_MARGIN, takeoffFocusRectForZone } from "@/lib/takeoffFocus";
import { publishTakeoffZoneToProjectLine } from "@/lib/takeoffPublishCloud";
import { DEFAULT_TAKEOFF_COLOR, TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import { defaultTakeoffUnitForKind, type ProjectMeasurementSystem } from "@/lib/projectMeasurement";
import { useViewerStore } from "@/store/viewerStore";
import { toast } from "sonner";

function formatPlanLengthForFormula(lengthMm: number, sys: ProjectMeasurementSystem): string {
  const u = sys === "IMPERIAL" ? ("ft" as const) : ("m" as const);
  const v = rawToDisplayUnit("linear", lengthMm, u);
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${u}`;
}

function formatPlanAreaForFormula(mm2: number, sys: ProjectMeasurementSystem): string {
  const u = sys === "IMPERIAL" ? ("ft²" as const) : ("m²" as const);
  const v = rawToDisplayUnit("area", mm2, u);
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${u}`;
}

function materialCustomSubtitle(
  m: MaterialRow,
  template: MaterialTemplate | undefined,
): string | null {
  if (!template?.fields?.length) return null;
  const parts: string[] = [];
  const sorted = [...template.fields].sort((a, b) => a.order - b.order);
  for (const f of sorted.slice(0, 4)) {
    const v = m.customAttributes?.[f.key];
    if (v == null || v === "") continue;
    parts.push(`${f.label}: ${v}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function unitsForKind(kind: TakeoffMeasurementType): TakeoffUnit[] {
  switch (kind) {
    case "area":
      return ["m²", "mm²", "ft²", "m³", "mm³", "ft³"];
    case "linear":
      return ["m", "mm", "ft", "m²", "mm²", "ft²", "kg"];
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
  const takeoffSliderManualOnly = useViewerStore((s) => s.takeoffSliderManualOnly);
  const currentPage = useViewerStore((s) => s.currentPage);

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
  const { data: materialTemplate } = useQuery({
    queryKey: qk.materialTemplate(workspaceId ?? ""),
    queryFn: () => fetchMaterialTemplate(workspaceId!),
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
  const [heightStr, setHeightStr] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightInputUnit>("m");
  const [manualKind, setManualKind] = useState<TakeoffMeasurementType>("area");
  const [directQtyStr, setDirectQtyStr] = useState("");

  const isManualFlow = Boolean(takeoffSliderManualOnly && !editZone && !pending);

  useEffect(() => {
    if (!open) return;
    const sys = (project?.measurementSystem as ProjectMeasurementSystem) || "METRIC";
    setHeightUnit(sys === "IMPERIAL" ? "ft" : "m");
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
      if (editItem.heightMm != null && editItem.heightMm > 0) {
        const hu: HeightInputUnit = sys === "IMPERIAL" ? "ft" : "m";
        setHeightUnit(hu);
        setHeightStr(formatHeightMmForUnit(editItem.heightMm, hu));
      } else {
        setHeightStr("");
      }
      setDirectQtyStr(editZone.noSheetGeometry ? String(editZone.computedQuantity) : "");
      return;
    }
    setHeightStr("");
    setDirectQtyStr("");
    if (takeoffSliderManualOnly) {
      const st = useViewerStore.getState();
      const mk = st.takeoffDrawKind;
      setManualKind(mk === "linear" || mk === "count" ? mk : "area");
      setName("");
      setCategory("");
      setUnit(defaultTakeoffUnitForKind(mk === "count" ? "count" : mk, sys));
      setColor(st.takeoffPenColor);
      setNotes("");
      setTagsStr("");
      setWastePct("");
      setLinearFactor("");
      setRate("");
      setSelectedMaterialId(null);
      return;
    }
    if (pending) {
      setName("");
      setCategory("");
      setUnit(defaultTakeoffUnitForKind(pending.kind, sys));
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
          if (
            it.heightMm != null &&
            it.heightMm > 0 &&
            (pending.kind === "area" || pending.kind === "linear")
          ) {
            const hu: HeightInputUnit = sys === "IMPERIAL" ? "ft" : "m";
            setHeightUnit(hu);
            setHeightStr(formatHeightMmForUnit(it.heightMm, hu));
          }
        }
      }
    }
  }, [
    open,
    editZone,
    editItem,
    pending,
    selectedItemId,
    items,
    project?.measurementSystem,
    takeoffSliderManualOnly,
  ]);

  const kind: TakeoffMeasurementType | null = isManualFlow
    ? manualKind
    : (pending?.kind ?? editZone?.measurementType ?? null);

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

  const heightMmPreview =
    heightStr.trim() && (kind === "area" || kind === "linear")
      ? heightMmFromInput(heightStr, heightUnit)
      : undefined;

  const previewComputedQty = useMemo(() => {
    if (!kind) return null;
    if (isManualFlow) {
      const q = Number(directQtyStr.replace(/,/g, ""));
      return Number.isFinite(q) ? q : null;
    }

    const wasteN = wastePct.trim() ? Number(wastePct) : 0;
    const lf = linearFactor.trim() ? Number(linearFactor) : undefined;
    const itemShape = {
      measurementType: kind,
      unit,
      wastePercent: Number.isFinite(wasteN) ? wasteN : undefined,
      linearFactor: Number.isFinite(lf) ? lf : undefined,
      heightMm: heightMmPreview,
    };

    const needsWallHeight =
      kind === "linear" &&
      (unit === "m²" || unit === "mm²" || unit === "ft²") &&
      (!heightMmPreview || heightMmPreview <= 0);
    const needsVolumeHeight =
      kind === "area" &&
      (unit === "m³" || unit === "mm³" || unit === "ft³") &&
      (!heightMmPreview || heightMmPreview <= 0);
    if (needsWallHeight || needsVolumeHeight) return null;

    if (pending) {
      const sz = pageSizePtByPage[pending.pageIndex];
      const cal = calibrationByPage[pending.pageIndex];
      if (!sz || !cal) return null;
      const raw = computeRawQuantity(kind, pending.points, sz.wPt, sz.hPt, cal.mmPerPdfUnit);
      return applyItemToRawQuantity(itemShape, raw);
    }

    if (editZone && editItem && !editZone.noSheetGeometry) {
      return applyItemToRawQuantity(
        {
          measurementType: editZone.measurementType,
          unit,
          wastePercent: Number.isFinite(wasteN) ? wasteN : undefined,
          linearFactor: Number.isFinite(lf) ? lf : undefined,
          heightMm: heightMmPreview,
        },
        editZone.rawQuantity,
      );
    }

    return null;
  }, [
    pending,
    editZone,
    editItem,
    kind,
    isManualFlow,
    directQtyStr,
    pageSizePtByPage,
    calibrationByPage,
    unit,
    wastePct,
    linearFactor,
    heightMmPreview,
  ]);

  const rateNum = rate.trim() ? Number(rate.replace(/,/g, "")) : NaN;
  const previewRateNum =
    Number.isFinite(rateNum) && rateNum >= 0
      ? rateNum
      : editItem?.rate != null && Number.isFinite(editItem.rate)
        ? editItem.rate
        : NaN;
  const estLineCost =
    previewComputedQty != null && Number.isFinite(previewRateNum) && previewRateNum >= 0
      ? previewComputedQty * previewRateNum
      : null;
  const editZoneCost =
    editZone && editItem && editItem.rate != null && Number.isFinite(editItem.rate)
      ? editZone.computedQuantity * editItem.rate
      : null;
  const editZoneDisplayQty =
    editZone && editItem && !editZone.noSheetGeometry && previewComputedQty != null
      ? previewComputedQty
      : editZone?.computedQuantity;
  const editZoneDisplayUnit =
    editZone && editItem && !editZone.noSheetGeometry && previewComputedQty != null
      ? unit
      : editItem?.unit;
  const editZoneEstCost =
    estLineCost != null && editZone && editItem && !editZone.noSheetGeometry
      ? estLineCost
      : editZoneCost;

  const measurementSys = (project?.measurementSystem as ProjectMeasurementSystem) || "METRIC";

  const linearLengthMmRaw = useMemo(() => {
    if (kind !== "linear") return null;
    if (pending && !editZone) {
      const sz = pageSizePtByPage[pending.pageIndex];
      const cal = calibrationByPage[pending.pageIndex];
      if (!sz || !cal) return null;
      return computeRawQuantity("linear", pending.points, sz.wPt, sz.hPt, cal.mmPerPdfUnit);
    }
    if (editZone && !editZone.noSheetGeometry && editZone.measurementType === "linear") {
      return editZone.rawQuantity;
    }
    return null;
  }, [kind, pending, editZone, pageSizePtByPage, calibrationByPage]);

  const planAreaMm2Raw = useMemo(() => {
    if (kind !== "area") return null;
    if (pending && !editZone) {
      const sz = pageSizePtByPage[pending.pageIndex];
      const cal = calibrationByPage[pending.pageIndex];
      if (!sz || !cal) return null;
      return computeRawQuantity("area", pending.points, sz.wPt, sz.hPt, cal.mmPerPdfUnit);
    }
    if (editZone && !editZone.noSheetGeometry && editZone.measurementType === "area") {
      return editZone.rawQuantity;
    }
    return null;
  }, [kind, pending, editZone, pageSizePtByPage, calibrationByPage]);

  const linearHeightIgnored =
    kind === "linear" &&
    heightMmPreview != null &&
    heightMmPreview > 0 &&
    (unit === "m" || unit === "mm" || unit === "ft" || unit === "kg");

  const wasteFormulaSuffix =
    wastePct.trim() && Number.isFinite(Number(wastePct)) && Number(wastePct) > 0
      ? ` · +${Number(wastePct)}% waste`
      : "";

  const totalAllZonesLive = useMemo(() => {
    if (!editItem) return null;
    const sum = sumZonesForItem(zones, editItem.id);
    if (editZone && !editZone.noSheetGeometry && previewComputedQty != null) {
      return sum - editZone.computedQuantity + previewComputedQty;
    }
    return sum;
  }, [editItem, editZone, zones, previewComputedQty]);

  const totalDisplayUnitForLine =
    editZone && editItem && !editZone.noSheetGeometry && previewComputedQty != null
      ? unit
      : editItem?.unit;

  const totalPendingWithNewZone = useMemo(() => {
    if (!pending || editZone || !selectedItemId) return null;
    if (!items.some((i) => i.id === selectedItemId)) return null;
    if (previewComputedQty == null) return null;
    return sumZonesForItem(zones, selectedItemId) + previewComputedQty;
  }, [pending, editZone, selectedItemId, items, zones, previewComputedQty]);

  const startRedrawShape = useCallback(() => {
    if (!editZone || editZone.locked || editZone.noSheetGeometry) return;
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
    if (!editZone || editZone.locked || editZone.noSheetGeometry) return;
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
      editZone.noSheetGeometry ||
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
    if (!editZone || !editItem || editZone.noSheetGeometry) return;
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

    const heightMmForItem =
      kind === "area" || kind === "linear"
        ? heightStr.trim()
          ? heightMmFromInput(heightStr, heightUnit)
          : undefined
        : undefined;

    const drawnAreaOnSheet =
      Boolean(pending?.kind === "area") ||
      Boolean(editZone && !editZone.noSheetGeometry && editZone.measurementType === "area");
    if (
      drawnAreaOnSheet &&
      (unit === "m³" || unit === "mm³" || unit === "ft³") &&
      (!heightMmForItem || heightMmForItem <= 0)
    ) {
      toast.error("Enter a height to use volume units (m³, mm³, ft³) with a sheet area.");
      return;
    }

    const drawnLinearOnSheet =
      Boolean(pending?.kind === "linear") ||
      Boolean(editZone && !editZone.noSheetGeometry && editZone.measurementType === "linear");
    if (
      drawnLinearOnSheet &&
      (unit === "m²" || unit === "mm²" || unit === "ft²") &&
      (!heightMmForItem || heightMmForItem <= 0)
    ) {
      toast.error(
        "Enter wall height to price by area — quantity is plan length × height (e.g. m × m → m²).",
      );
      return;
    }

    if (isManualFlow) {
      const q = Number(directQtyStr.replace(/,/g, ""));
      if (!Number.isFinite(q) || q < 0) {
        toast.error("Enter a valid quantity.");
        return;
      }
      const rateN = rate.trim() ? Number(rate.replace(/,/g, "")) : undefined;
      const itemId = takeoffAddItem({
        name: name.trim() || "New item",
        category: category.trim() || undefined,
        unit,
        measurementType: kind,
        color,
        notes: notes.trim() || undefined,
        rate: rateN,
        materialId: selectedMaterialId,
      });
      const pageIdx = Math.max(0, currentPage - 1);
      const newZoneId = takeoffAddZone({
        itemId,
        pageIndex: pageIdx,
        points: [],
        measurementType: kind,
        rawQuantity: q,
        computedQuantity: q,
        notes: notes.trim() || undefined,
        tags: zoneTags.length ? zoneTags : undefined,
        createdBy: displayName,
        noSheetGeometry: true,
      });
      const st2 = useViewerStore.getState();
      st2.setTakeoffSelectedItemId(itemId);
      st2.setTakeoffSelectedZoneIds([newZoneId]);
      st2.bumpTakeoffInventoryExpand();
      const zPub = st2.takeoffZones.find((x) => x.id === newZoneId);
      const itemPub = st2.takeoffItems.find((i) => i.id === itemId);
      const cfv = useViewerStore.getState().cloudFileVersionId;
      if (cfv && zPub && itemPub) {
        publishTakeoffZoneToProjectLine(cfv, itemPub, zPub);
      }
      setTakeoffPenColor(color);
      closeTakeoffSlider();
      return;
    }

    if (editZone && editItem) {
      if (editZone.noSheetGeometry) {
        const q = Number(directQtyStr.replace(/,/g, ""));
        if (!Number.isFinite(q) || q < 0) {
          toast.error("Enter a valid quantity.");
          return;
        }
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
          heightMm: heightMmForItem,
        });
        takeoffUpdateZone(editZone.id, {
          rawQuantity: q,
          computedQuantity: q,
          notes: notes.trim() || undefined,
          tags: zoneTags,
        });
        const stE = useViewerStore.getState();
        const zAfter = stE.takeoffZones.find((x) => x.id === editZone.id);
        const itAfter = stE.takeoffItems.find((i) => i.id === editItem.id);
        const cfv = useViewerStore.getState().cloudFileVersionId;
        if (cfv && zAfter && itAfter) {
          publishTakeoffZoneToProjectLine(cfv, itAfter, zAfter);
        }
        closeTakeoffSlider();
        return;
      }

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
        heightMm: heightMmForItem,
      });
      const st = useViewerStore.getState();
      const nextItem = st.takeoffItems.find((i) => i.id === editItem.id);
      if (nextItem) {
        for (const z of st.takeoffZones.filter((x) => x.itemId === nextItem.id)) {
          if (z.noSheetGeometry) {
            takeoffUpdateZone(z.id, {
              ...(z.id === editZone.id
                ? {
                    notes: notes.trim() || undefined,
                    tags: zoneTags,
                  }
                : {}),
            });
            continue;
          }
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
        heightMm: heightMmForItem,
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
        heightMm: heightMmForItem,
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
        aria-label={
          editZone
            ? "Edit takeoff zone"
            : isManualFlow
              ? "Add manual takeoff line"
              : "New takeoff item"
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[#f8fafc]">
            {editZone
              ? editZone.noSheetGeometry
                ? "Manual takeoff line"
                : "Takeoff zone"
              : isManualFlow
                ? "Add line from material"
                : "New takeoff item"}
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
          {isManualFlow ? (
            <div className="mb-4 rounded-lg border border-sky-500/35 bg-sky-950/40 px-3 py-2.5 text-[11px] text-sky-100">
              <p className="font-semibold uppercase tracking-wide text-sky-300/90">
                Manual quantity
              </p>
              <p className="mt-1 leading-snug text-sky-200/90">
                Link a catalog material and enter a quantity without drawing on the plan. The line
                is grouped under the page you are viewing for export and reports.
              </p>
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-sky-400/90">
                Measure type
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(["area", "linear", "count"] as const).map((t) => {
                  const active = manualKind === t;
                  const label = t === "area" ? "Area" : t === "linear" ? "Linear" : "Count";
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setManualKind(t);
                        const sys =
                          (project?.measurementSystem as ProjectMeasurementSystem) || "METRIC";
                        setUnit(defaultTakeoffUnitForKind(t, sys));
                      }}
                      className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold ${
                        active
                          ? "border-sky-500/60 bg-sky-600/30 text-sky-50"
                          : "border-slate-600 bg-slate-900/60 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block text-[10px] text-sky-100">
                <span className="mb-1 block font-semibold text-sky-200/95">Quantity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={directQtyStr}
                  onChange={(e) => setDirectQtyStr(e.target.value.replace(/[^\d.,-]/g, ""))}
                  placeholder="e.g. 12.5"
                  className="mt-1 w-full rounded-md border border-sky-500/40 bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc] placeholder:text-[#64748b]"
                />
              </label>
            </div>
          ) : null}

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
              {pending.kind === "linear" &&
              (unit === "m²" || unit === "mm²" || unit === "ft²") &&
              linearLengthMmRaw != null &&
              heightMmPreview != null &&
              heightMmPreview > 0 &&
              previewComputedQty != null ? (
                <div className="mt-1.5 space-y-1 border-t border-emerald-500/25 pt-1.5 tabular-nums text-emerald-50">
                  <p>
                    <span className="font-semibold text-emerald-200/95">Wall area (formula): </span>
                    <span className="text-emerald-100/95">
                      plan length {formatPlanLengthForFormula(linearLengthMmRaw, measurementSys)} ×
                      height {heightStr.trim()} {heightUnit}
                      {wasteFormulaSuffix}
                    </span>
                  </p>
                  <p>
                    = {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    {unit}
                  </p>
                </div>
              ) : null}
              {pending.kind === "area" &&
              (unit === "m³" || unit === "mm³" || unit === "ft³") &&
              planAreaMm2Raw != null &&
              heightMmPreview != null &&
              heightMmPreview > 0 &&
              previewComputedQty != null ? (
                <div className="mt-1.5 space-y-1 border-t border-emerald-500/25 pt-1.5 tabular-nums text-emerald-50">
                  <p>
                    <span className="font-semibold text-emerald-200/95">Volume (formula): </span>
                    <span className="text-emerald-100/95">
                      plan area {formatPlanAreaForFormula(planAreaMm2Raw, measurementSys)} × height{" "}
                      {heightStr.trim()} {heightUnit}
                      {wasteFormulaSuffix}
                    </span>
                  </p>
                  <p>
                    = {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    {unit}
                  </p>
                </div>
              ) : null}
              {selectedItemId && totalPendingWithNewZone != null ? (
                <p className="mt-1.5 border-t border-emerald-500/25 pt-1.5 tabular-nums text-sky-200/95">
                  <span className="font-semibold text-sky-300/90">Line total after save: </span>
                  {totalPendingWithNewZone.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {unit}
                </p>
              ) : null}
            </div>
          ) : null}

          {editZone && editItem && !editZone.noSheetGeometry ? (
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
                  {(editZoneDisplayQty ?? editZone.computedQuantity).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {editZoneDisplayUnit ?? editItem.unit}
                </span>
              </p>
              {editZone.measurementType === "linear" &&
              (unit === "m²" || unit === "mm²" || unit === "ft²") &&
              linearLengthMmRaw != null &&
              heightMmPreview != null &&
              heightMmPreview > 0 &&
              previewComputedQty != null ? (
                <p className="tabular-nums text-slate-200">
                  <span className="font-semibold text-slate-400">Wall area: </span>
                  plan length {formatPlanLengthForFormula(linearLengthMmRaw, measurementSys)} ×
                  height {heightStr.trim()} {heightUnit}
                  {wasteFormulaSuffix} →{" "}
                  {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  {unit}
                </p>
              ) : null}
              {editZone.measurementType === "area" &&
              (unit === "m³" || unit === "mm³" || unit === "ft³") &&
              planAreaMm2Raw != null &&
              heightMmPreview != null &&
              heightMmPreview > 0 &&
              previewComputedQty != null ? (
                <p className="tabular-nums text-slate-200">
                  <span className="font-semibold text-slate-400">Volume: </span>
                  plan area {formatPlanAreaForFormula(planAreaMm2Raw, measurementSys)} × height{" "}
                  {heightStr.trim()} {heightUnit}
                  {wasteFormulaSuffix} →{" "}
                  {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  {unit}
                </p>
              ) : null}
              <p>
                Total (all zones):{" "}
                <span className="tabular-nums text-sky-300">
                  {(totalAllZonesLive ?? sumZonesForItem(zones, editItem.id)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 },
                  )}{" "}
                  {totalDisplayUnitForLine ?? editItem.unit}
                </span>
              </p>
              {editZoneEstCost != null ? (
                <p>
                  Est. this zone (qty × rate):{" "}
                  <span className="font-semibold tabular-nums text-amber-200/95">
                    {editZoneEstCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {selectedMaterial?.currency ? (
                    <span className="text-slate-400"> {selectedMaterial.currency}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {editZone && editItem && editZone.noSheetGeometry ? (
            <div className="mb-4 rounded-lg border border-violet-500/35 bg-violet-950/35 px-3 py-2 text-[11px] text-violet-100">
              <p className="font-semibold text-violet-200/95">Manual line (no sheet shape)</p>
              <p className="mt-1 tabular-nums text-violet-50">
                Quantity:{" "}
                {editZone.computedQuantity.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                {editItem.unit}
                <span className="ml-2 text-violet-300/90">· p.{editZone.pageIndex + 1}</span>
              </p>
            </div>
          ) : null}

          {editZone && editItem && !editZone.noSheetGeometry ? (
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
                      {filteredMaterials.map((m) => {
                        const customSub = materialCustomSubtitle(m, materialTemplate);
                        return (
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
                              {customSub ? (
                                <span className="block text-[9px] leading-snug text-[#64748b]">
                                  {customSub}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
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

          {editZone?.noSheetGeometry ? (
            <label className="mb-3 block text-[11px] text-[#94a3b8]">
              Quantity
              <input
                type="text"
                inputMode="decimal"
                value={directQtyStr}
                onChange={(e) => setDirectQtyStr(e.target.value.replace(/[^\d.,-]/g, ""))}
                className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
              />
            </label>
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
              disabled={Boolean(selectedItemId && !editZone && !isManualFlow && !pending)}
              className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc] disabled:opacity-50"
            >
              {(kind ? unitsForKind(kind) : ["m²"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          {(kind === "area" || kind === "linear") &&
          (Boolean(pending) || Boolean(editZone && editItem && !editZone.noSheetGeometry)) ? (
            <div className="mb-3 rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2.5">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {kind === "linear" ? "Wall height (vertical)" : "Height (extrusion)"}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-[11px] text-[#94a3b8]">
                  {kind === "linear" ? "Height" : "Extrusion height"}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={heightStr}
                    onChange={(e) => setHeightStr(e.target.value.replace(/[^\d.,-]/g, ""))}
                    placeholder={kind === "linear" ? "e.g. floor-to-ceiling" : "Optional"}
                    className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
                  />
                </label>
                <label className="block shrink-0 text-[11px] text-[#94a3b8] sm:w-28">
                  Unit
                  <select
                    value={heightUnit}
                    onChange={(e) => setHeightUnit(e.target.value as HeightInputUnit)}
                    className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
                  >
                    <option value="m">m</option>
                    <option value="mm">mm</option>
                    <option value="ft">ft</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[#64748b]">
                {kind === "linear" ? (
                  <>
                    Choose display unit <strong className="font-medium text-slate-400">m²</strong>,{" "}
                    <strong className="font-medium text-slate-400">mm²</strong>, or{" "}
                    <strong className="font-medium text-slate-400">ft²</strong> for wall finishes:
                    quantity ={" "}
                    <strong className="font-medium text-slate-400">plan length × height</strong>.
                    Use <strong className="font-medium text-slate-400">m</strong> / mm / ft for
                    length-only lines (no height). If you add height but the unit is still m / mm /
                    ft, height is ignored until you switch the unit to m², mm², or ft².
                  </>
                ) : (
                  <>
                    With <strong className="font-medium text-slate-400">m³</strong>, mm³, or ft³:
                    multiplies <strong className="font-medium text-slate-400">plan area</strong> by
                    this height. Leave empty for flat area (m²) takeoff.
                  </>
                )}
              </p>
              {linearHeightIgnored ? (
                <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-950/50 px-2 py-1.5 text-[10px] leading-snug text-amber-100">
                  Height is entered but the display unit is length (m / mm / ft / kg). Change{" "}
                  <strong className="font-medium text-amber-200">Unit</strong> above to m², mm², or
                  ft² so quantity uses{" "}
                  <strong className="font-medium text-amber-200">plan length × height</strong> and
                  cost updates.
                </p>
              ) : null}
            </div>
          ) : null}

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

          {!isManualFlow ? (
            <label className="mb-3 block text-[11px] text-[#94a3b8]">
              Waste %
              <input
                value={wastePct}
                onChange={(e) => setWastePct(e.target.value.replace(/[^\d.]/g, ""))}
                className="mt-1 w-full rounded-md border border-[#475569] bg-[#0f172a] px-2 py-2 text-[12px] text-[#f8fafc]"
                placeholder="0"
              />
            </label>
          ) : null}

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

          {estLineCost != null && previewComputedQty != null ? (
            <div className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-100">
              <p className="font-semibold uppercase tracking-wide text-emerald-300/90">
                Estimated line cost
              </p>
              <p className="mt-1 tabular-nums">
                {previewComputedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}{" "}
                × {previewRateNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} ={" "}
                <span className="font-semibold text-white">
                  {estLineCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {selectedMaterial?.currency ? (
                  <span className="text-emerald-200/80"> {selectedMaterial.currency}</span>
                ) : null}
              </p>
            </div>
          ) : null}

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
            disabled={
              (!editZone && !pending && !isManualFlow) || (isManualFlow && !directQtyStr.trim())
            }
            onClick={() => onSave()}
          >
            {editZone ? "Save" : isManualFlow ? "Add line" : "Save item"}
          </button>
        </div>
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}

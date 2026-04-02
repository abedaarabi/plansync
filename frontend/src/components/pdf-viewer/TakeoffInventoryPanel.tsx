"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sumZonesForItem } from "@/lib/takeoffCompute";
import {
  TAKEOFF_FOCUS_FIT_MARGIN,
  takeoffFocusRectForItem,
  takeoffFocusRectForZone,
  takeoffFocusRectForZoneIds,
} from "@/lib/takeoffFocus";
import type {
  TakeoffItem,
  TakeoffMeasurementType,
  TakeoffUnit,
  TakeoffZone,
} from "@/lib/takeoffTypes";
import { DEFAULT_TAKEOFF_COLOR } from "@/lib/takeoffUi";
import { useViewerStore } from "@/store/viewerStore";

const ITEM_EXPAND_STORAGE_KEY = "takeoff-inv-item-expanded-v1";

type GroupMode = "none" | "type" | "page" | "category";

type RowModel = {
  item: TakeoffItem;
  zoneCount: number;
  quantity: number;
  pageLabel: string;
};

function loadItemExpandedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(ITEM_EXPAND_STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveItemExpandedIds(ids: string[]) {
  try {
    sessionStorage.setItem(ITEM_EXPAND_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* quota / private mode */
  }
}

function displayUnit(u: TakeoffUnit): string {
  const m: Partial<Record<TakeoffUnit, string>> = {
    "m²": "M2",
    m: "M",
    "m³": "M3",
    "mm²": "MM2",
    mm: "MM",
    "ft²": "FT2",
    ft: "FT",
    ea: "EA",
    kg: "KG",
  };
  return m[u] ?? String(u).toUpperCase();
}

function typeLabel(t: TakeoffMeasurementType): string {
  if (t === "area") return "Area";
  if (t === "linear") return "Linear";
  return "Count";
}

function categorySegments(cat: string | undefined): string[] {
  if (!cat?.trim()) return ["Uncategorized"];
  return cat
    .split(/\s*[/›>]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type CatTree = {
  label: string;
  rows: RowModel[];
  children: Map<string, CatTree>;
};

function emptyCatTree(label: string): CatTree {
  return { label, rows: [], children: new Map() };
}

function addRowToCatTree(root: CatTree, segments: string[], row: RowModel) {
  let node = root;
  for (const seg of segments) {
    if (!node.children.has(seg)) {
      node.children.set(seg, emptyCatTree(seg));
    }
    node = node.children.get(seg)!;
  }
  node.rows.push(row);
}

function formatPageLabel(zs: TakeoffZone[]): string {
  if (zs.length === 0) return "—";
  const pages = [...new Set(zs.map((z) => z.pageIndex + 1))].sort((a, b) => a - b);
  if (pages.length === 1) return `p.${pages[0]}`;
  return `p.${pages[0]}–${pages[pages.length - 1]}`;
}

function primaryPageIndex(zs: TakeoffZone[]): number {
  if (zs.length === 0) return -1;
  return Math.min(...zs.map((z) => z.pageIndex));
}

function buildRowModelsForGrouping(items: TakeoffItem[], zones: TakeoffZone[]): RowModel[] {
  const list = items.map((item) => {
    const zs = zones.filter((z) => z.itemId === item.id);
    return {
      item,
      zoneCount: zs.length,
      quantity: sumZonesForItem(zones, item.id),
      pageLabel: formatPageLabel(zs),
    };
  });
  list.sort((a, b) => a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" }));
  return list;
}

function zonesForItemSorted(zones: TakeoffZone[], itemId: string): TakeoffZone[] {
  return [...zones.filter((z) => z.itemId === itemId)].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return a.createdAt - b.createdAt;
  });
}

export function TakeoffInventoryPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [nameSortDesc, setNameSortDesc] = useState(false);
  const [groupExpandedKeys, setGroupExpandedKeys] = useState<Set<string>>(() => new Set());
  const [itemExpandedIds, setItemExpandedIds] = useState<string[]>(() => loadItemExpandedIds());
  const [bulkIds, setBulkIds] = useState<Set<string>>(() => new Set());

  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const takeoffSelectedItemId = useViewerStore((s) => s.takeoffSelectedItemId);
  const takeoffSelectedZoneIds = useViewerStore((s) => s.takeoffSelectedZoneIds);
  const setTakeoffSelectedItemId = useViewerStore((s) => s.setTakeoffSelectedItemId);
  const setTakeoffSelectedZoneIds = useViewerStore((s) => s.setTakeoffSelectedZoneIds);
  const setTakeoffPenColor = useViewerStore((s) => s.setTakeoffPenColor);
  const setTakeoffHoverItemId = useViewerStore((s) => s.setTakeoffHoverItemId);
  const setTakeoffHoverZoneId = useViewerStore((s) => s.setTakeoffHoverZoneId);
  const takeoffRemoveItem = useViewerStore((s) => s.takeoffRemoveItem);
  const takeoffRemoveZone = useViewerStore((s) => s.takeoffRemoveZone);
  const takeoffRemoveZonesBulk = useViewerStore((s) => s.takeoffRemoveZonesBulk);
  const takeoffUndoLastZoneDeletion = useViewerStore((s) => s.takeoffUndoLastZoneDeletion);
  const requestSearchFocus = useViewerStore((s) => s.requestSearchFocus);
  const openTakeoffSlider = useViewerStore((s) => s.openTakeoffSlider);
  const setTool = useViewerStore((s) => s.setTool);
  const setTakeoffMode = useViewerStore((s) => s.setTakeoffMode);

  const zoneSelSet = useMemo(() => new Set(takeoffSelectedZoneIds), [takeoffSelectedZoneIds]);

  const rows = useMemo((): RowModel[] => {
    const list = buildRowModelsForGrouping(takeoffItems, takeoffZones);
    if (!nameSortDesc) return list;
    return [...list].sort((a, b) => {
      const cmp = a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
      return -cmp;
    });
  }, [takeoffItems, takeoffZones, nameSortDesc]);

  useEffect(() => {
    saveItemExpandedIds(itemExpandedIds);
  }, [itemExpandedIds]);

  useEffect(() => {
    if (takeoffSelectedZoneIds.length === 0) return;
    const itemIds = new Set(
      takeoffZones.filter((z) => takeoffSelectedZoneIds.includes(z.id)).map((z) => z.itemId),
    );
    setItemExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of itemIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? [...next] : prev;
    });
  }, [takeoffSelectedZoneIds, takeoffZones]);

  useEffect(() => {
    if (groupMode === "none") {
      setGroupExpandedKeys(new Set());
      return;
    }
    const { takeoffItems: items, takeoffZones: zones } = useViewerStore.getState();
    const rowList = buildRowModelsForGrouping(items, zones);
    const next = new Set<string>();
    if (groupMode === "type") {
      for (const t of ["area", "linear", "count"] as const) {
        if (rowList.some((r) => r.item.measurementType === t)) next.add(`g:type:${t}`);
      }
    } else if (groupMode === "page") {
      const seen = new Set<number>();
      for (const r of rowList) {
        const zs = zones.filter((z) => z.itemId === r.item.id);
        seen.add(primaryPageIndex(zs));
      }
      for (const k of [...seen].sort((a, b) => a - b)) next.add(`g:page:${k}`);
    } else if (groupMode === "category") {
      const root = emptyCatTree("");
      for (const r of rowList) addRowToCatTree(root, categorySegments(r.item.category), r);
      const walk = (node: CatTree, prefix: string) => {
        for (const [seg, child] of node.children) {
          const key = prefix ? `${prefix}>${seg}` : `cat:${seg}`;
          next.add(key);
          walk(child, key);
        }
      };
      walk(root, "");
    }
    setGroupExpandedKeys(next);
  }, [groupMode]);

  const toggleGroupExpanded = (key: string) => {
    setGroupExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleItemExpanded = (itemId: string) => {
    setItemExpandedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );
  };

  const focusItemOnCanvas = useCallback(
    (itemId: string) => {
      const st = useViewerStore.getState();
      st.setTakeoffSelectedItemId(itemId);
      st.setTakeoffSelectedZoneIds([]);
      const item = st.takeoffItems.find((i) => i.id === itemId);
      if (item) st.setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
      const focus = takeoffFocusRectForItem(st.takeoffZones, itemId);
      if (focus) {
        requestSearchFocus({
          pageNumber: focus.pageIndex0 + 1,
          rectNorm: focus.rectNorm,
          fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
        });
      }
    },
    [requestSearchFocus],
  );

  const focusZoneOnCanvas = useCallback(
    (z: TakeoffZone, item: TakeoffItem) => {
      setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
      setTakeoffSelectedItemId(item.id);
      setTakeoffSelectedZoneIds([z.id]);
      const focus = takeoffFocusRectForZone(z);
      requestSearchFocus({
        pageNumber: focus.pageIndex0 + 1,
        rectNorm: focus.rectNorm,
        fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
      });
    },
    [requestSearchFocus, setTakeoffPenColor, setTakeoffSelectedItemId, setTakeoffSelectedZoneIds],
  );

  const selectAllZonesForItem = (itemId: string) => {
    const ids = takeoffZones.filter((z) => z.itemId === itemId).map((z) => z.id);
    const item = takeoffItems.find((i) => i.id === itemId);
    if (item) setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
    setTakeoffSelectedItemId(itemId);
    setTakeoffSelectedZoneIds(ids);
  };

  const toggleZoneCheckbox = (zoneId: string, itemId: string) => {
    const st = useViewerStore.getState();
    const item = st.takeoffItems.find((i) => i.id === itemId);
    if (item) st.setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
    st.setTakeoffSelectedItemId(itemId);
    const cur = [...st.takeoffSelectedZoneIds];
    const ix = cur.indexOf(zoneId);
    if (ix >= 0) cur.splice(ix, 1);
    else cur.push(zoneId);
    st.setTakeoffSelectedZoneIds(cur);
  };

  const deleteZonesWithToast = (ids: string[]) => {
    if (ids.length === 0) return;
    const r = takeoffRemoveZonesBulk(ids);
    if (r.removed === 0) {
      if (r.skippedLocked > 0) toast.error("Selected zones are locked and cannot be deleted.");
      return;
    }
    toast.success(`Removed ${r.removed} zone${r.removed === 1 ? "" : "s"}.`, {
      action: {
        label: "Undo",
        onClick: () => {
          takeoffUndoLastZoneDeletion();
          toast.message("Zones restored.");
        },
      },
    });
    if (r.skippedLocked > 0) {
      toast.message(`${r.skippedLocked} locked zone${r.skippedLocked === 1 ? "" : "s"} skipped.`);
    }
  };

  const deleteOneZone = (z: TakeoffZone) => {
    if (z.locked) {
      toast.error("This zone is locked.");
      return;
    }
    if (!window.confirm("Delete this zone from the takeoff?")) return;
    takeoffRemoveZone(z.id);
    toast.success("Zone removed.", {
      action: {
        label: "Undo",
        onClick: () => {
          takeoffUndoLastZoneDeletion();
          toast.message("Zone restored.");
        },
      },
    });
  };

  const fitSelectedZones = () => {
    const focus = takeoffFocusRectForZoneIds(takeoffZones, takeoffSelectedZoneIds);
    if (!focus) {
      toast.message("Could not fit — no matching zones.");
      return;
    }
    requestSearchFocus({
      pageNumber: focus.pageIndex0 + 1,
      rectNorm: focus.rectNorm,
      fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
    });
  };

  const clearHover = () => {
    setTakeoffHoverItemId(null);
    setTakeoffHoverZoneId(null);
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const zid = takeoffSelectedZoneIds[0];
    const iid = takeoffSelectedItemId;
    const sel = zid
      ? root.querySelector(`[data-takeoff-zone-id="${zid}"]`)
      : iid
        ? root.querySelector(`[data-takeoff-item-id="${iid}"]`)
        : null;
    sel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [takeoffSelectedItemId, takeoffSelectedZoneIds]);

  const setBulkForItem = (itemId: string, checked: boolean) => {
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setBulkIds(new Set(rows.map((r) => r.item.id)));
  };

  const clearBulk = () => setBulkIds(new Set());

  const deleteBulk = () => {
    const n = bulkIds.size;
    if (n === 0) return;
    if (!window.confirm(`Remove ${n} takeoff item${n === 1 ? "" : "s"} and all their zones?`))
      return;
    for (const id of bulkIds) {
      takeoffRemoveItem(id);
    }
    clearBulk();
  };

  const bulkCount = bulkIds.size;
  const zoneBulkCount = takeoffSelectedZoneIds.length;

  const onInventoryKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Delete") return;
    if (takeoffSelectedZoneIds.length === 0) return;
    e.preventDefault();
    deleteZonesWithToast([...takeoffSelectedZoneIds]);
  };

  const renderZoneRows = (item: TakeoffItem, zones: TakeoffZone[]) => {
    if (zones.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-[#334155] bg-[#0f172a]/80 px-3 py-3 text-center">
          <p className="text-[10px] leading-relaxed text-[#94a3b8]">
            No zones yet — draw on the sheet with the Takeoff tool, then save.
          </p>
          <button
            type="button"
            onClick={() => {
              setTakeoffSelectedItemId(item.id);
              setTakeoffSelectedZoneIds([]);
              setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
              setTakeoffMode(true);
              setTool("takeoff");
            }}
            className="viewer-focus-ring mt-2 inline-flex items-center gap-1 rounded-md border border-[#2563EB]/50 bg-[#2563EB]/10 px-2 py-1.5 text-[10px] font-semibold text-[#93c5fd] hover:bg-[#2563EB]/20"
          >
            <Plus className="h-3 w-3" />
            Start drawing
          </button>
        </div>
      );
    }

    return (
      <div className="max-h-56 space-y-1 overflow-y-auto [scrollbar-width:thin] pr-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => selectAllZonesForItem(item.id)}
            className="viewer-focus-ring rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8] hover:border-sky-500/40 hover:text-sky-200"
          >
            Select all zones
          </button>
        </div>
        {zones.map((z, i) => {
          const checked = zoneSelSet.has(z.id);
          return (
            <div
              key={z.id}
              data-takeoff-zone-id={z.id}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1.5 text-[10px] ${
                checked ? "border-sky-500/50 bg-sky-950/35" : "border-[#334155] bg-[#0f172a]"
              }`}
              onMouseEnter={() => {
                setTakeoffHoverZoneId(z.id);
                setTakeoffHoverItemId(null);
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleZoneCheckbox(z.id, item.id)}
                onClick={(ev) => ev.stopPropagation()}
                disabled={false}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[#475569] bg-[#0f172a] accent-[#2563EB]"
                aria-label={`Select zone ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => focusZoneOnCanvas(z, item)}
                className="viewer-focus-ring min-w-0 flex-1 truncate text-left text-[#cbd5e1] hover:text-white"
              >
                <span className="font-medium text-[#94a3b8]">Zone {i + 1}</span>
                <span className="ml-1 tabular-nums text-[#f8fafc]">
                  {z.computedQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  {displayUnit(item.unit)}
                </span>
                <span className="ml-1 text-[#64748b]">p.{z.pageIndex + 1}</span>
                {z.locked ? (
                  <span className="ml-1 text-[9px] font-medium text-amber-400">Locked</span>
                ) : null}
              </button>
              <button
                type="button"
                title={z.locked ? "Zone is locked" : "Edit zone"}
                disabled={z.locked}
                onClick={() => {
                  setTakeoffPenColor(item.color || DEFAULT_TAKEOFF_COLOR);
                  setTakeoffSelectedItemId(item.id);
                  setTakeoffSelectedZoneIds([z.id]);
                  openTakeoffSlider({ editZoneId: z.id });
                }}
                className="viewer-focus-ring shrink-0 rounded p-1 text-[#94a3b8] hover:bg-[#334155] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={z.locked ? "Zone is locked" : "Delete zone"}
                disabled={z.locked}
                onClick={() => deleteOneZone(z)}
                className="viewer-focus-ring shrink-0 rounded p-1 text-red-300/90 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemRows = (r: RowModel, indentPx: number): ReactNode[] => {
    const { item } = r;
    const sel = takeoffSelectedItemId === item.id;
    const bulk = bulkIds.has(item.id);
    const itemOpen = itemExpandedIds.includes(item.id);
    const zones = zonesForItemSorted(takeoffZones, item.id);

    const mainRow = (
      <tr
        key={item.id}
        data-takeoff-item-id={item.id}
        onMouseEnter={() => {
          setTakeoffHoverItemId(item.id);
          setTakeoffHoverZoneId(null);
        }}
        className={`border-b border-[#334155] transition-colors duration-150 ${
          sel
            ? "bg-[#1e3a5f]"
            : bulk
              ? "bg-[#1e293b] ring-1 ring-inset ring-[#2563EB]/40"
              : "bg-[#1e293b] hover:bg-[#334155]"
        }`}
      >
        <td className="w-9 px-1 py-2 align-middle" style={{ paddingLeft: Math.min(indentPx, 32) }}>
          <input
            type="checkbox"
            checked={bulk}
            onChange={(e) => {
              e.stopPropagation();
              setBulkForItem(item.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 cursor-pointer rounded border-[#475569] bg-[#0f172a] text-[#2563EB] accent-[#2563EB]"
            aria-label={`Select line ${item.name}`}
          />
        </td>
        <td className="min-w-0 px-2 py-2 align-middle">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleItemExpanded(item.id)}
              aria-expanded={itemOpen}
              aria-controls={`takeoff-item-zones-${item.id}`}
              title={itemOpen ? "Collapse zones" : "Expand zones"}
              className="viewer-focus-ring shrink-0 rounded p-0.5 text-[#94a3b8] hover:bg-[#334155] hover:text-white"
            >
              {itemOpen ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                focusItemOnCanvas(item.id);
                setItemExpandedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
              }}
              className="viewer-focus-ring flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="truncate text-[11px] font-medium text-[#f8fafc]">{item.name}</span>
              <span className="shrink-0 rounded bg-[#334155] px-1 py-0.5 text-[9px] font-semibold tabular-nums text-[#cbd5e1]">
                {r.zoneCount}z
              </span>
            </button>
          </div>
        </td>
        <td className="w-14 px-2 py-2 text-right tabular-nums text-[11px] text-[#94a3b8]">
          {r.zoneCount}
        </td>
        <td className="w-24 px-2 py-2 text-right tabular-nums text-[11px] text-[#f8fafc]">
          {r.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </td>
        <td className="w-16 px-2 py-2 text-[11px] text-[#94a3b8]">{displayUnit(item.unit)}</td>
        <td className="w-20 px-2 py-2 tabular-nums text-[11px] text-[#94a3b8]">{r.pageLabel}</td>
        <td className="w-20 px-2 py-2 text-[11px] text-[#94a3b8]">
          {typeLabel(item.measurementType)}
        </td>
      </tr>
    );

    const zoneBlock = itemOpen ? (
      <tr key={`${item.id}-zones`} className="border-b border-[#334155] bg-[#0c1219]">
        <td colSpan={7} className="px-2 py-2" style={{ paddingLeft: Math.min(indentPx + 24, 40) }}>
          <div
            id={`takeoff-item-zones-${item.id}`}
            role="region"
            aria-label={`Zones for ${item.name}`}
          >
            {renderZoneRows(item, zones)}
          </div>
        </td>
      </tr>
    ) : null;

    return zoneBlock ? [mainRow, zoneBlock] : [mainRow];
  };

  const renderGroupedBody = (): ReactNode => {
    if (groupMode === "none") {
      return rows.flatMap((r) => renderItemRows(r, 8));
    }
    if (groupMode === "type") {
      const types: TakeoffMeasurementType[] = ["area", "linear", "count"];
      const nodes: React.ReactNode[] = [];
      for (const t of types) {
        const sub = rows.filter((r) => r.item.measurementType === t);
        if (sub.length === 0) continue;
        const gkey = `g:type:${t}`;
        const open = groupExpandedKeys.has(gkey);
        nodes.push(
          <tr key={gkey} className="bg-[#0f172a]">
            <td colSpan={7} className="px-2 py-1.5">
              <button
                type="button"
                onClick={() => toggleGroupExpanded(gkey)}
                aria-expanded={open}
                className="viewer-focus-ring inline-flex items-center gap-1 text-left text-[11px] font-semibold text-[#f8fafc]"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                )}
                {typeLabel(t)}
              </button>
            </td>
          </tr>,
        );
        if (open) nodes.push(...sub.flatMap((r) => renderItemRows(r, 8)));
      }
      return nodes;
    }
    if (groupMode === "page") {
      const byPage = new Map<number, RowModel[]>();
      for (const r of rows) {
        const zs = takeoffZones.filter((z) => z.itemId === r.item.id);
        const p = primaryPageIndex(zs);
        const k = p < 0 ? -1 : p;
        if (!byPage.has(k)) byPage.set(k, []);
        byPage.get(k)!.push(r);
      }
      const keys = [...byPage.keys()].sort((a, b) => a - b);
      const nodes: React.ReactNode[] = [];
      for (const p of keys) {
        const sub = byPage.get(p)!;
        const label = p < 0 ? "No page" : `p.${p + 1}`;
        const gkey = `g:page:${p}`;
        const open = groupExpandedKeys.has(gkey);
        nodes.push(
          <tr key={gkey} className="bg-[#0f172a]">
            <td colSpan={7} className="px-2 py-1.5">
              <button
                type="button"
                onClick={() => toggleGroupExpanded(gkey)}
                aria-expanded={open}
                className="viewer-focus-ring inline-flex items-center gap-1 text-left text-[11px] font-semibold text-[#f8fafc]"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                )}
                {label}
              </button>
            </td>
          </tr>,
        );
        if (open) nodes.push(...sub.flatMap((r) => renderItemRows(r, 8)));
      }
      return nodes;
    }
    const root = emptyCatTree("");
    for (const r of rows) addRowToCatTree(root, categorySegments(r.item.category), r);

    const renderCatNode = (node: CatTree, pathKey: string, depth: number): ReactNode[] => {
      const out: ReactNode[] = [];
      const sorted = [...node.children.entries()].sort((a, b) =>
        a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base" }),
      );
      for (const [seg, child] of sorted) {
        const key = pathKey ? `${pathKey}>${seg}` : `cat:${seg}`;
        const open = groupExpandedKeys.has(key);
        out.push(
          <tr key={key} className="bg-[#0f172a]">
            <td colSpan={7} className="px-2 py-1.5" style={{ paddingLeft: 8 + depth * 14 }}>
              <button
                type="button"
                onClick={() => toggleGroupExpanded(key)}
                aria-expanded={open}
                className="viewer-focus-ring inline-flex items-center gap-1 text-left text-[11px] font-semibold text-[#f8fafc]"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" aria-hidden />
                )}
                {seg}
              </button>
            </td>
          </tr>,
        );
        if (open) {
          out.push(...renderCatNode(child, key, depth + 1));
        }
      }
      if (pathKey && node.rows.length > 0 && groupExpandedKeys.has(pathKey)) {
        const indent = 8 + (depth + 1) * 10;
        for (const row of node.rows) out.push(...renderItemRows(row, indent));
      }
      return out;
    };

    return renderCatNode(root, "", 0);
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#334155] bg-[#0f172a] px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-[#94a3b8]">Group by</span>
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="viewer-focus-ring max-w-[140px] rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1 text-[10px] font-medium text-[#f8fafc]"
          >
            <option value="none">None</option>
            <option value="type">Type</option>
            <option value="page">Page</option>
            <option value="category">Category</option>
          </select>
          {bulkCount >= 2 ? (
            <>
              <span className="rounded-md bg-[#1e3a5f] px-2 py-0.5 text-[10px] font-semibold text-[#93c5fd]">
                {bulkCount} lines
              </span>
              <button
                type="button"
                onClick={deleteBulk}
                className="viewer-focus-ring rounded-md border border-red-500/40 bg-red-950/50 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-950/80"
              >
                Delete lines
              </button>
              <button
                type="button"
                onClick={clearBulk}
                className="viewer-focus-ring text-[10px] text-[#94a3b8] underline hover:text-[#cbd5e1]"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={rows.length === 0}
              className="viewer-focus-ring text-[10px] text-[#94a3b8] underline hover:text-[#cbd5e1] disabled:opacity-40"
            >
              Select all lines
            </button>
          )}
        </div>
        {zoneBulkCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-500/30 bg-sky-950/25 px-2 py-1.5">
            <span className="text-[10px] font-semibold text-sky-200">
              {zoneBulkCount} zone{zoneBulkCount === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={fitSelectedZones}
              className="viewer-focus-ring rounded border border-sky-500/40 bg-sky-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-100 hover:bg-sky-950/70"
            >
              Fit on sheet
            </button>
            <button
              type="button"
              onClick={() => deleteZonesWithToast([...takeoffSelectedZoneIds])}
              className="viewer-focus-ring rounded border border-red-500/35 bg-red-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-200 hover:bg-red-950/65"
            >
              Delete zones
            </button>
            <button
              type="button"
              onClick={() => setTakeoffSelectedZoneIds([])}
              className="viewer-focus-ring text-[9px] text-[#94a3b8] underline hover:text-[#cbd5e1]"
            >
              Clear selection
            </button>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-[#64748b] hover:bg-[#1e293b] hover:text-[#94a3b8]"
              title="⌘/Ctrl-click a zone on the sheet to add or remove from selection."
              aria-label="Multi-select on sheet help"
            >
              <Info className="h-3 w-3" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Takeoff inventory list"
        className="relative min-h-0 min-w-0 flex-1 overflow-auto outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-sky-500/40"
        onMouseLeave={clearHover}
        onKeyDown={onInventoryKeyDown}
      >
        {takeoffItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <p className="text-[12px] font-medium text-[#f8fafc]">No takeoff items yet</p>
            <p className="max-w-sm text-[11px] leading-relaxed text-[#94a3b8]">
              Draw on the sheet to start measuring. Use the Takeoff tool, then finish a shape and
              save in the side panel.
            </p>
            <button
              type="button"
              onClick={() => {
                setTakeoffMode(true);
                setTool("takeoff");
              }}
              className="viewer-focus-ring inline-flex items-center gap-1.5 rounded-md border border-[#2563EB] bg-[#2563EB]/15 px-3 py-2 text-[11px] font-semibold text-[#60a5fa] transition hover:bg-[#2563EB]/25"
            >
              Start drawing
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-[#334155] bg-[#0f172a] shadow-sm">
              <tr className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                <th className="w-9 px-1 py-2" aria-label="Select line" />
                <th className="min-w-0 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setNameSortDesc((d) => !d)}
                    className="viewer-focus-ring inline-flex items-center gap-0.5 hover:text-[#cbd5e1]"
                  >
                    Name
                    <span className="tabular-nums text-[#64748b]">{nameSortDesc ? "↓" : "↑"}</span>
                  </button>
                </th>
                <th className="w-14 px-2 py-2 text-right">Zones</th>
                <th className="w-24 px-2 py-2 text-right">Quantity</th>
                <th className="w-16 px-2 py-2">Unit</th>
                <th className="w-20 px-2 py-2">Page</th>
                <th className="w-20 px-2 py-2">Type</th>
              </tr>
            </thead>
            <tbody>{renderGroupedBody()}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

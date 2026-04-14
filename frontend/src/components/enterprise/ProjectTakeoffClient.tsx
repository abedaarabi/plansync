"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Columns3,
  Calculator,
  Download,
  ExternalLink,
  History,
  RefreshCw,
  Loader2,
  PanelRightOpen,
  Plus,
  Ruler,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  applyTakeoffSync,
  bulkTakeoffAction,
  createTakeoffView,
  createProjectTakeoffLineFromMaterial,
  deleteTakeoffView,
  deleteTakeoffLine,
  fetchMaterials,
  fetchProject,
  fetchTakeoffSyncHistory,
  fetchTakeoffViews,
  fetchTakeoffLinesForProject,
  patchProject,
  patchTakeoffLine,
  patchTakeoffView,
  previewTakeoffSync,
  restoreTakeoffSnapshot,
  type ProjectMeta,
  type TakeoffSyncHistoryRow,
  type TakeoffSyncPreview,
  type TakeoffViewPresetRow,
  type TakeoffLineRow,
  ProRequiredError,
  viewerHrefForTakeoffLine,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { PROJECT_TAKEOFF_INVALIDATE_CHANNEL } from "@/lib/takeoffPublishCloud";
import { TakeoffMaterialsSlider } from "@/components/enterprise/TakeoffMaterialsSlider";

function takeoffLineGroupKey(row: TakeoffLineRow): string {
  return row.materialId ?? `${row.label}::${row.unit}`;
}

function lineGross(row: TakeoffLineRow): number {
  const q = Number(row.quantity) || 0;
  const p = Number(row.material?.unitPrice ?? 0) || 0;
  return q * p;
}

function lineItemDiscPct(
  row: TakeoffLineRow,
  itemDiscountPctByKey: Record<string, string>,
): number {
  const k = takeoffLineGroupKey(row);
  return Math.max(0, Number(itemDiscountPctByKey[k] ?? "0") || 0);
}

function lineNetAfterItemDisc(
  row: TakeoffLineRow,
  itemDiscountPctByKey: Record<string, string>,
): number {
  const g = lineGross(row);
  const d = lineItemDiscPct(row, itemDiscountPctByKey);
  return g * (1 - d / 100);
}

function serializeTakeoffDiscountState(proj: string, items: Record<string, string>): string {
  const keys = Object.keys(items).sort();
  const normalized: Record<string, string> = {};
  for (const k of keys) normalized[k] = items[k] ?? "0";
  return JSON.stringify({ proj, items: normalized });
}

export function ProjectTakeoffClient({
  projectId,
  workspaceId: workspaceIdProp,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const takeoffKey = qk.takeoffForProject(projectId);
  const [projectDiscountPct, setProjectDiscountPct] = useState("0");
  const [itemDiscountPctByKey, setItemDiscountPctByKey] = useState<Record<string, string>>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState<string | null>(null);
  const [showOnlyManual, setShowOnlyManual] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [materialsSliderOpen, setMaterialsSliderOpen] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [syncPreview, setSyncPreview] = useState<TakeoffSyncPreview | null>(null);
  const [syncMode, setSyncMode] = useState<"merge" | "replace">("merge");
  const [protectManualEdits, setProtectManualEdits] = useState(true);
  const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [viewNameDraft, setViewNameDraft] = useState("");
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [highlightedRowIds, setHighlightedRowIds] = useState<string[]>([]);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    file: true,
    item: true,
    qty: true,
    unit: true,
    rate: true,
    gross: true,
    disc: true,
    net: true,
    tags: true,
    notes: true,
    sheet: true,
    mismatch: true,
  });
  const takeoffDiscountsBaselineRef = useRef<string | null>(null);

  const {
    data: lines = [],
    isPending,
    isError,
    error: takeoffLoadError,
    refetch: refetchTakeoffLines,
  } = useQuery({
    queryKey: takeoffKey,
    queryFn: () => fetchTakeoffLinesForProject(projectId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
  const { data: takeoffViews = [] } = useQuery({
    queryKey: [...takeoffKey, "views"],
    queryFn: () => fetchTakeoffViews(projectId),
  });
  const { data: takeoffSyncHistory = [] } = useQuery({
    queryKey: [...takeoffKey, "syncHistory"],
    queryFn: () => fetchTakeoffSyncHistory(projectId),
    enabled: syncHistoryOpen,
  });

  useEffect(() => {
    if (!isPending) setLastSyncedAt(Date.now());
  }, [isPending, lines.length]);

  async function runReloadFromDrawings(opts?: { silent?: boolean }) {
    const prevRows = lines;
    const prevById = new Map(prevRows.map((r) => [r.id, r.updatedAt]));
    const prevIds = new Set(prevRows.map((r) => r.id));

    const res = await refetchTakeoffLines();
    const nextRows = res.data ?? [];
    const nextIds = new Set(nextRows.map((r) => r.id));

    let added = 0;
    let removed = 0;
    let updated = 0;
    const changedIds: string[] = [];
    for (const row of nextRows) {
      if (!prevIds.has(row.id)) {
        added += 1;
        changedIds.push(row.id);
        continue;
      }
      if (prevById.get(row.id) !== row.updatedAt) {
        updated += 1;
        changedIds.push(row.id);
      }
    }
    for (const row of prevRows) {
      if (!nextIds.has(row.id)) removed += 1;
    }
    setLastSyncedAt(Date.now());
    setHighlightedRowIds(changedIds.slice(0, 200));
    if (changedIds.length) {
      window.setTimeout(() => setHighlightedRowIds([]), 2200);
    }
    if (!opts?.silent) {
      toast.success(
        `Synced from drawings: ${added} added, ${updated} updated, ${removed} removed.`,
      );
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => {
      void runReloadFromDrawings({ silent: true });
    }, 20000);
    return () => window.clearInterval(t);
  }, [autoRefresh, lines, refetchTakeoffLines]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(PROJECT_TAKEOFF_INVALIDATE_CHANNEL);
    bc.onmessage = (ev: MessageEvent<{ projectId?: string }>) => {
      if (ev.data?.projectId === projectId) {
        void runReloadFromDrawings({ silent: true });
      }
    };
    return () => bc.close();
  }, [projectId, lines, refetchTakeoffLines]);
  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = workspaceIdProp ?? project?.workspaceId;

  const takeoffPricingSignature = project?.takeoffPricing
    ? `${project.takeoffPricing.projectDiscountPct}:${JSON.stringify(project.takeoffPricing.itemDiscountPctByKey)}`
    : "";

  useLayoutEffect(() => {
    if (!project?.id) return;
    const tp = project.takeoffPricing;
    const proj = tp?.projectDiscountPct ?? "0";
    const items = { ...(tp?.itemDiscountPctByKey ?? {}) };
    setProjectDiscountPct(proj);
    setItemDiscountPctByKey(items);
    takeoffDiscountsBaselineRef.current = serializeTakeoffDiscountState(proj, items);
  }, [project?.id, takeoffPricingSignature]);

  const discountsSerialized = serializeTakeoffDiscountState(
    projectDiscountPct,
    itemDiscountPctByKey,
  );

  useEffect(() => {
    if (!project?.id) return;
    const baseline = takeoffDiscountsBaselineRef.current;
    if (baseline == null) return;
    if (discountsSerialized === baseline) return;

    const t = window.setTimeout(() => {
      void patchProject(projectId, {
        takeoffPricing: {
          projectDiscountPct,
          itemDiscountPctByKey,
        },
      })
        .then((meta) => {
          qc.setQueryData(qk.project(projectId), meta);
          const tp = meta.takeoffPricing;
          const proj = tp?.projectDiscountPct ?? "0";
          const items = { ...(tp?.itemDiscountPctByKey ?? {}) };
          takeoffDiscountsBaselineRef.current = serializeTakeoffDiscountState(proj, items);
        })
        .catch((e: Error) => toast.error(e.message));
    }, 500);
    return () => window.clearTimeout(t);
  }, [discountsSerialized, project?.id, projectId, projectDiscountPct, itemDiscountPctByKey, qc]);

  const projectFilesHref = `/projects/${projectId}/files`;

  useEffect(() => {
    if (!workspaceIdProp && workspaceId && pathname.startsWith(`/projects/${projectId}/takeoff`)) {
      router.replace(`/workspaces/${workspaceId}/projects/${projectId}/takeoff`);
    }
  }, [pathname, projectId, router, workspaceId, workspaceIdProp]);
  const {
    data: hubMaterials = [],
    isPending: hubMaterialsLoading,
    isError: hubMaterialsError,
  } = useQuery({
    queryKey: qk.materials(workspaceId ?? ""),
    queryFn: () => fetchMaterials(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const patchMut = useMutation({
    mutationFn: (vars: { id: string; quantity: string }) =>
      patchTakeoffLine(vars.id, { quantity: vars.quantity }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: takeoffKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteTakeoffLine(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: takeoffKey });
      toast.success("Line removed");
    },
    onError: (e: Error) =>
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message),
  });

  const addCatalogToCostingMut = useMutation({
    mutationFn: (materialId: string) =>
      createProjectTakeoffLineFromMaterial(projectId, { materialId, quantity: 1 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: takeoffKey });
      if (typeof BroadcastChannel !== "undefined") {
        try {
          const bc = new BroadcastChannel(PROJECT_TAKEOFF_INVALIDATE_CHANNEL);
          bc.postMessage({ projectId });
          bc.close();
        } catch {
          /* ignore */
        }
      }
      toast.success("Material added to takeoff and costing");
    },
    onError: (e: Error) =>
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message),
  });

  const syncPreviewMut = useMutation({
    mutationFn: () => previewTakeoffSync(projectId),
    onSuccess: (data) => {
      setSyncPreview(data);
      setSyncMode("merge");
      setProtectManualEdits(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncApplyMut = useMutation({
    mutationFn: (vars: { mode: "merge" | "replace"; protectManualEdits?: boolean }) =>
      applyTakeoffSync(projectId, vars),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: takeoffKey });
      void qc.invalidateQueries({ queryKey: [...takeoffKey, "syncHistory"] });
      setSyncPreview(null);
      if (res.snapshotId) setLastSnapshotId(res.snapshotId);
      toast.success(
        `Sync applied: ${res.counts.added} added, ${res.counts.updated} updated, ${res.counts.removed} removed.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (vars: {
      action: "delete" | "set_tags" | "set_rate_placeholder";
      tags?: string[];
    }) =>
      bulkTakeoffAction(projectId, { ids: selectedLineIds, action: vars.action, tags: vars.tags }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: takeoffKey });
      setSelectedLineIds([]);
      toast.success(`Bulk action applied to ${res.affected} line(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createViewMut = useMutation({
    mutationFn: (body: {
      name: string;
      isDefault?: boolean;
      configJson: Record<string, unknown>;
    }) => createTakeoffView(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...takeoffKey, "views"] });
      toast.success("View saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchViewMut = useMutation({
    mutationFn: (vars: {
      viewId: string;
      body: { name?: string; isDefault?: boolean; configJson?: Record<string, unknown> };
    }) => patchTakeoffView(projectId, vars.viewId, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...takeoffKey, "views"] });
      toast.success("View updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteViewMut = useMutation({
    mutationFn: (viewId: string) => deleteTakeoffView(projectId, viewId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...takeoffKey, "views"] });
      setSelectedViewId(null);
      toast.success("View deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreSnapshotMut = useMutation({
    mutationFn: (snapshotId: string) => restoreTakeoffSnapshot(projectId, snapshotId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: takeoffKey });
      toast.success("Undo complete.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const row of lines) {
      for (const t of row.tags ?? []) {
        if (t.trim()) s.add(t.trim());
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [lines]);

  const visibleLines = useMemo(() => {
    return lines.filter((r) => {
      if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
      if (fileFilter && r.fileId !== fileFilter) return false;
      if (showOnlyManual && r.sourceZoneId?.trim()) return false;
      return true;
    });
  }, [lines, tagFilter, fileFilter, showOnlyManual]);

  const linkedLineCount = useMemo(
    () => lines.filter((r) => Boolean(r.sourceZoneId?.trim())).length,
    [lines],
  );
  const manualLineCount = Math.max(0, lines.length - linkedLineCount);

  const tableLines = useMemo(() => {
    const q = lineSearch.trim().toLowerCase();
    if (!q) return visibleLines;
    return visibleLines.filter((r) => {
      const item = [
        r.label?.trim(),
        r.material ? `${r.material.categoryName} ${r.material.name}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const blob = [
        r.fileName,
        String(r.fileVersion),
        item,
        (r.tags ?? []).join(" "),
        r.notes ?? "",
        r.unit,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [visibleLines, lineSearch]);
  const tableLinesForRender = useMemo(() => tableLines.slice(0, 600), [tableLines]);

  const totalsBySheet = useMemo(() => {
    const m = new Map<string, { label: string; total: number }>();
    for (const r of tableLines) {
      const key = r.fileId;
      const prev = m.get(key);
      const net = lineNetAfterItemDisc(r, itemDiscountPctByKey);
      if (prev) prev.total += net;
      else m.set(key, { label: r.fileName, total: net });
    }
    return [...m.entries()]
      .map(([fileId, v]) => ({ fileId, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tableLines, itemDiscountPctByKey]);

  const totalsByPrimaryTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of tableLines) {
      const tags = r.tags ?? [];
      const primary = tags.length > 0 ? tags[0]!.trim() : "Untagged";
      const k = primary || "Untagged";
      m.set(k, (m.get(k) ?? 0) + lineNetAfterItemDisc(r, itemDiscountPctByKey));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tableLines, itemDiscountPctByKey]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        unit: string;
        qty: number;
        rate: number;
        currency: string;
      }
    >();
    for (const row of lines) {
      const key = takeoffLineGroupKey(row);
      const prev = map.get(key);
      const qty = Number(row.quantity) || 0;
      const rate = Number(row.material?.unitPrice ?? 0) || 0;
      if (prev) {
        prev.qty += qty;
      } else {
        map.set(key, {
          key,
          label:
            row.label?.trim() ||
            (row.material ? `${row.material.categoryName} — ${row.material.name}` : "Item"),
          unit: row.unit,
          qty,
          rate,
          currency: row.material?.currency ?? "USD",
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [lines]);

  const pricing = useMemo(() => {
    const itemRows = grouped.map((g) => {
      const gross = g.qty * g.rate;
      const discPct = Math.max(0, Number(itemDiscountPctByKey[g.key] ?? "0") || 0);
      const discount = gross * (discPct / 100);
      const net = gross - discount;
      return { ...g, gross, discPct, discount, net };
    });
    const subtotal = itemRows.reduce((s, r) => s + r.gross, 0);
    const itemDiscountTotal = itemRows.reduce((s, r) => s + r.discount, 0);
    const afterItemDiscount = subtotal - itemDiscountTotal;
    const projectDiscPct = Math.max(0, Number(projectDiscountPct) || 0);
    const projectDiscount = afterItemDiscount * (projectDiscPct / 100);
    const grandTotal = afterItemDiscount - projectDiscount;
    return {
      itemRows,
      subtotal,
      itemDiscountTotal,
      afterItemDiscount,
      projectDiscPct,
      projectDiscount,
      grandTotal,
    };
  }, [grouped, itemDiscountPctByKey, projectDiscountPct]);

  const activeFilterSummary = useMemo(() => {
    const qty = tableLines.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const gross = tableLines.reduce((s, r) => s + lineGross(r), 0);
    const net = tableLines.reduce((s, r) => s + lineNetAfterItemDisc(r, itemDiscountPctByKey), 0);
    return { qty, gross, net };
  }, [tableLines, itemDiscountPctByKey]);

  const currentViewConfig = useMemo(
    () => ({
      tagFilter,
      fileFilter,
      showOnlyManual,
      lineSearch,
      visibleColumns,
    }),
    [tagFilter, fileFilter, showOnlyManual, lineSearch, visibleColumns],
  );

  function parseViewConfig(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    }
    return {};
  }

  function applyViewConfig(v: TakeoffViewPresetRow) {
    const c = parseViewConfig(v.configJson);
    setTagFilter(typeof c.tagFilter === "string" ? c.tagFilter : null);
    setFileFilter(typeof c.fileFilter === "string" ? c.fileFilter : null);
    setShowOnlyManual(Boolean(c.showOnlyManual));
    setLineSearch(typeof c.lineSearch === "string" ? c.lineSearch : "");
    if (c.visibleColumns && typeof c.visibleColumns === "object") {
      setVisibleColumns((prev) => ({ ...prev, ...(c.visibleColumns as typeof prev) }));
    }
    setSelectedViewId(v.id);
    toast.success(`Applied view: ${v.name}`);
  }

  function exportCsv() {
    const headers = [
      "File",
      "Version",
      "Item",
      "Quantity",
      "Unit",
      "Rate",
      "Currency",
      "Line gross",
      "Disc %",
      "Line net (after item disc)",
      "Tags",
      "Notes",
    ];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = lines.map((r) =>
      [
        r.fileName,
        String(r.fileVersion),
        r.label?.trim()
          ? r.material
            ? `${r.label.trim()} (${r.material.categoryName} — ${r.material.name})`
            : r.label.trim()
          : r.material
            ? `${r.material.categoryName} — ${r.material.name}`
            : r.label || "",
        r.quantity,
        r.unit,
        r.material?.unitPrice ?? "",
        r.material?.currency ?? "",
        lineGross(r).toFixed(2),
        lineItemDiscPct(r, itemDiscountPctByKey).toFixed(2),
        lineNetAfterItemDisc(r, itemDiscountPctByKey).toFixed(2),
        (r.tags ?? []).join("; "),
        r.notes ?? "",
      ]
        .map((c) => esc(String(c)))
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `takeoff-${projectId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="sticky top-0 z-10 rounded-xl border border-[#DBEAFE] bg-white/90 p-2.5 shadow-sm backdrop-blur-md sm:top-2 sm:p-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={() => syncPreviewMut.mutate()}
            className="touch-manipulation inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] sm:rounded-md sm:py-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Preview sync</span>
          </button>
          <button
            type="button"
            onClick={() => void runReloadFromDrawings()}
            className="touch-manipulation inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] sm:rounded-md sm:py-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0 sm:hidden" />
            <span className="truncate">Reload</span>
          </button>
          <button
            type="button"
            onClick={() => setMaterialsSliderOpen(true)}
            className="touch-manipulation inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] sm:col-span-1 sm:rounded-md sm:py-1.5"
          >
            <PanelRightOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Materials</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLineSearch("");
              setTagFilter(null);
              setFileFilter(null);
              setShowOnlyManual(false);
            }}
            className="touch-manipulation inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] sm:rounded-md sm:py-1.5"
          >
            <span className="truncate">Clear filters</span>
          </button>
          <button
            type="button"
            onClick={() => setSyncHistoryOpen((v) => !v)}
            className="touch-manipulation col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] sm:col-span-1 sm:ml-auto sm:justify-start sm:rounded-md sm:py-1.5"
          >
            <History className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Sync history</span>
          </button>
          {lastSnapshotId ? (
            <button
              type="button"
              onClick={() => restoreSnapshotMut.mutate(lastSnapshotId)}
              className="touch-manipulation col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 sm:col-span-1 sm:rounded-md sm:py-1.5"
            >
              <span className="truncate">Undo last sync</span>
            </button>
          ) : null}
        </div>
      </div>
      <header className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC]/80 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#BFDBFE]/80 sm:h-12 sm:w-12"
              aria-hidden
            >
              <Ruler className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl sm:text-[1.65rem]">
                Quantity Takeoff
              </h1>
              {project?.name ? (
                <p className="mt-1 line-clamp-2 text-sm text-[#64748B]" title={project.name}>
                  {project.name}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto lg:shrink-0">
            <button
              type="button"
              onClick={() => void runReloadFromDrawings()}
              disabled={isPending}
              className="touch-manipulation inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-sm font-semibold text-[#1D4ED8] shadow-sm transition hover:bg-[#DBEAFE] disabled:opacity-50 sm:min-h-0 sm:rounded-lg"
              title="Reload all takeoff lines from project drawings"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              )}
              Reload from drawings
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={lines.length === 0}
              className="touch-manipulation inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-40 sm:min-h-0 sm:rounded-lg"
            >
              <Download className="h-4 w-4 text-[#64748B]" strokeWidth={1.75} />
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-[#1E3A8A]">
              Sync status:{" "}
              <strong className="font-semibold tabular-nums">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "Not synced yet"}
              </strong>
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[#1E40AF]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-[#93C5FD] text-[#2563EB] focus:ring-[#2563EB]"
              />
              Auto refresh every 20s
            </label>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#334155]">
            Loaded lines: <strong>{lines.length}</strong> total ({linkedLineCount} linked to zones,{" "}
            {manualLineCount} manual).
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
            <Calculator className="h-4 w-4" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Costing and discounts</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[#64748B]">
          Item and project discounts save automatically to the project. Line totals below use item
          discount %; the project discount applies once on the subtotal.
        </p>
        <div className="space-y-2">
          {pricing.itemRows.length > 0 ? (
            <div className="hidden items-end gap-2 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B] lg:grid lg:grid-cols-[minmax(0,1fr)_90px_120px_120px]">
              <span>Item</span>
              <span className="text-right">Disc %</span>
              <span className="text-right">Discount</span>
              <span className="text-right">Net</span>
            </div>
          ) : null}
          {pricing.itemRows.map((r) => (
            <div
              key={r.key}
              className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] px-3 py-3 text-sm sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_90px_120px_120px] lg:items-center lg:gap-2 lg:space-y-0 lg:bg-white lg:py-2.5"
            >
              <div className="min-w-0 border-b border-[#E2E8F0]/80 pb-3 lg:border-0 lg:pb-0">
                <p className="font-medium leading-snug text-[#0F172A] lg:truncate">{r.label}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Qty {r.qty.toFixed(2)} {r.unit} × Rate {r.rate.toFixed(2)} {r.currency}
                </p>
              </div>
              <label className="flex flex-col gap-1.5 lg:gap-0">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] lg:sr-only">
                  Disc %
                </span>
                <input
                  value={itemDiscountPctByKey[r.key] ?? "0"}
                  onChange={(e) =>
                    setItemDiscountPctByKey((prev) => ({ ...prev, [r.key]: e.target.value }))
                  }
                  className="min-h-[44px] w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-2 text-right tabular-nums lg:min-h-0 lg:rounded-md lg:py-1"
                  title="Item discount %"
                  spellCheck={false}
                  suppressHydrationWarning
                />
              </label>
              <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] lg:hidden">
                  Discount
                </span>
                <span className="tabular-nums text-[#64748B]">-{r.discount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F0]/60 pt-3 lg:block lg:border-0 lg:pt-0 lg:text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] lg:hidden">
                  Net
                </span>
                <span className="text-base font-semibold tabular-nums text-[#0F172A] lg:text-sm">
                  {r.net.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-4">
            <label className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <span className="shrink-0 text-[#64748B]">Project discount %</span>
              <input
                value={projectDiscountPct}
                onChange={(e) => setProjectDiscountPct(e.target.value)}
                className="min-h-[40px] w-28 rounded-lg border border-[#E2E8F0] px-2 py-2 text-right tabular-nums sm:min-h-0 sm:w-24 sm:rounded-md sm:py-1"
              />
            </label>
          </div>
          <div className="mt-3 space-y-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-sm text-[#334155] sm:px-4">
            <div className="flex justify-between gap-4">
              <span>Subtotal</span>
              <span className="tabular-nums">{pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Item discounts</span>
              <span className="tabular-nums">-{pricing.itemDiscountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Project discount ({pricing.projectDiscPct.toFixed(2)}%)</span>
              <span className="tabular-nums">-{pricing.projectDiscount.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4 border-t border-[#E2E8F0] pt-2 text-base font-semibold text-[#0F172A]">
              <span>Grand total</span>
              <span className="tabular-nums">{pricing.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {isPending ? (
        <EnterpriseLoadingState
          variant="minimal"
          message="Loading takeoff…"
          label="Loading quantity takeoff"
        />
      ) : isError ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-900"
          style={{ borderRadius: "12px" }}
        >
          <p className="font-semibold">Could not load takeoff lines</p>
          <p className="mt-2 text-red-800/90">
            {takeoffLoadError instanceof Error ? takeoffLoadError.message : "Request failed."} Often
            this means the database migration for takeoff lines has not been applied on the server,
            or you need to sign in again.
          </p>
          <button
            type="button"
            onClick={() => void refetchTakeoffLines()}
            className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          {lines.length > 0 ? (
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                By sheet (net of item discount %)
              </p>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {totalsBySheet.map((s) => (
                  <span
                    key={s.fileId}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155]"
                  >
                    <span className="max-w-[200px] truncate font-medium text-[#0F172A]">
                      {s.label}
                    </span>
                    <span className="tabular-nums text-[#64748B]">{s.total.toFixed(2)}</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                By primary tag (first tag per line, net of item discount %)
              </p>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {totalsByPrimaryTag.map(([tag, total]) => (
                  <span
                    key={tag}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155]"
                  >
                    <span className="font-medium text-[#0F172A]">{tag}</span>
                    <span className="tabular-nums text-[#64748B]">{total.toFixed(2)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-medium text-[#64748B]">
                  Filter by tag
                </span>
                <div className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  <button
                    type="button"
                    onClick={() => setTagFilter(null)}
                    className={`touch-manipulation shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                      tagFilter === null
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                        : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagFilter(t)}
                      className={`touch-manipulation shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                        tagFilter === t
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                          : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-medium text-[#64748B]">
                  Filter by sheet
                </span>
                <div className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  <button
                    type="button"
                    onClick={() => setFileFilter(null)}
                    className={`touch-manipulation shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                      fileFilter === null
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                        : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    All sheets
                  </button>
                  {totalsBySheet.map((s) => (
                    <button
                      key={s.fileId}
                      type="button"
                      onClick={() => setFileFilter(s.fileId)}
                      className={`touch-manipulation max-w-[min(280px,85vw)] shrink-0 truncate rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                        fileFilter === s.fileId
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                          : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                      }`}
                      title={s.label}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                  <input
                    value={lineSearch}
                    onChange={(e) => setLineSearch(e.target.value)}
                    placeholder="Search file, item, tags, notes…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    type="search"
                    autoComplete="off"
                    spellCheck={false}
                    suppressHydrationWarning
                  />
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#334155] shadow-sm">
                  <input
                    type="checkbox"
                    checked={showOnlyManual}
                    onChange={(e) => setShowOnlyManual(e.target.checked)}
                  />
                  Manual lines only
                </label>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                <button
                  type="button"
                  onClick={() => setColumnsOpen((v) => !v)}
                  className="touch-manipulation inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#334155] sm:min-h-0 sm:rounded-md sm:py-1.5"
                >
                  <Columns3 className="h-3.5 w-3.5 shrink-0" />
                  Columns
                </button>
                <input
                  value={viewNameDraft}
                  onChange={(e) => setViewNameDraft(e.target.value)}
                  placeholder="View name"
                  className="min-h-[40px] w-full min-w-0 flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs sm:min-h-0 sm:w-40 sm:rounded-md sm:py-1 sm:pl-2"
                />
                <button
                  type="button"
                  onClick={() =>
                    createViewMut.mutate({
                      name: viewNameDraft.trim() || "New view",
                      configJson: currentViewConfig,
                    })
                  }
                  className="touch-manipulation min-h-[40px] rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] sm:min-h-0 sm:rounded-md sm:py-1.5"
                >
                  Save view
                </button>
                <select
                  value={selectedViewId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setSelectedViewId(id);
                    const v = takeoffViews.find((x) => x.id === id);
                    if (v) applyViewConfig(v);
                  }}
                  className="min-h-[40px] w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs sm:min-h-0 sm:w-auto sm:min-w-[10rem] sm:rounded-md sm:py-1"
                >
                  <option value="">Select view</option>
                  {takeoffViews.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {selectedViewId ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() =>
                        patchViewMut.mutate({
                          viewId: selectedViewId,
                          body: { configJson: currentViewConfig },
                        })
                      }
                      className="touch-manipulation min-h-[40px] rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] sm:min-h-0 sm:rounded-md sm:py-1.5"
                    >
                      Update view
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteViewMut.mutate(selectedViewId)}
                      className="touch-manipulation min-h-[40px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:min-h-0 sm:rounded-md sm:py-1.5"
                    >
                      Delete view
                    </button>
                  </div>
                ) : null}
              </div>
              {columnsOpen ? (
                <div className="mt-2 flex flex-wrap gap-2 rounded-md border border-[#E2E8F0] bg-white px-2 py-2">
                  {(Object.keys(visibleColumns) as Array<keyof typeof visibleColumns>).map((k) => (
                    <label
                      key={k}
                      className="inline-flex items-center gap-1 text-xs text-[#334155]"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[k]}
                        onChange={(e) =>
                          setVisibleColumns((prev) => ({ ...prev, [k]: e.target.checked }))
                        }
                      />
                      {k}
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-3 text-xs text-[#334155] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:py-2">
                <span className="font-semibold text-[#0F172A]">Filtered totals</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="tabular-nums">Qty {activeFilterSummary.qty.toFixed(2)}</span>
                  <span className="tabular-nums">Gross {activeFilterSummary.gross.toFixed(2)}</span>
                  <span className="font-medium tabular-nums text-[#0F172A]">
                    Net {activeFilterSummary.net.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          {selectedLineIds.length > 0 ? (
            <div className="mx-3 mb-2 flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs sm:mx-4 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="font-semibold text-[#334155]">
                {selectedLineIds.length} selected
              </span>
              <input
                value={bulkTagsInput}
                onChange={(e) => setBulkTagsInput(e.target.value)}
                placeholder="tag1, tag2"
                className="min-h-[40px] w-full rounded-lg border border-[#CBD5E1] px-3 py-2 sm:min-h-0 sm:w-48 sm:rounded-md sm:py-1"
              />
              <button
                type="button"
                onClick={() =>
                  bulkMut.mutate({
                    action: "set_tags",
                    tags: bulkTagsInput
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                className="touch-manipulation inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-semibold text-[#334155] sm:min-h-0 sm:rounded-md sm:py-1"
              >
                <Tags className="h-3.5 w-3.5" />
                Set tags
              </button>
              <button
                type="button"
                onClick={() => bulkMut.mutate({ action: "delete" })}
                className="touch-manipulation min-h-[40px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 sm:min-h-0 sm:rounded-md sm:py-1"
              >
                Delete selected
              </button>
            </div>
          ) : null}
          {lines.length > 0 && tableLinesForRender.length > 0 ? (
            <div className="flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 md:hidden">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#334155]">
                <input
                  type="checkbox"
                  checked={
                    tableLinesForRender.length > 0 &&
                    selectedLineIds.length === tableLinesForRender.length
                  }
                  onChange={(e) =>
                    setSelectedLineIds(e.target.checked ? tableLinesForRender.map((r) => r.id) : [])
                  }
                  className="h-4 w-4 rounded border-[#CBD5E1]"
                />
                Select all visible ({tableLinesForRender.length})
              </label>
            </div>
          ) : null}
          <ul className="md:hidden" aria-label="Takeoff lines">
            {lines.length === 0 ? (
              <li className="px-4 py-12 text-center text-sm text-[#64748B]">
                <p className="mx-auto max-w-lg">
                  No takeoff lines yet. Open a drawing from{" "}
                  <Link
                    href={projectFilesHref}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Files &amp; Drawings
                  </Link>
                  , use the Takeoff tool, finish a shape, then press{" "}
                  <strong className="font-semibold text-[#334155]">Save</strong> in the takeoff
                  panel. Each save syncs one line here.
                </p>
                <p className="mx-auto mt-3 max-w-lg text-xs text-[#94A3B8]">
                  Refresh if you just saved, and confirm this page is for the same project as the
                  sheet.
                </p>
              </li>
            ) : tableLinesForRender.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-[#64748B]">
                No lines match your search or tag filter.{" "}
                <button
                  type="button"
                  className="font-semibold text-[#2563EB] hover:underline"
                  onClick={() => {
                    setLineSearch("");
                    setTagFilter(null);
                    setFileFilter(null);
                    setShowOnlyManual(false);
                  }}
                >
                  Clear filters
                </button>
              </li>
            ) : (
              tableLinesForRender.map((row) => {
                const itemLabel = row.material
                  ? `${row.material.categoryName} — ${row.material.name}`
                  : row.label || "—";
                return (
                  <li
                    key={row.id}
                    className={`touch-manipulation border-b border-[#E2E8F0]/80 px-4 py-4 transition-colors ${
                      highlightedRowIds.includes(row.id) ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-[#CBD5E1]"
                        checked={selectedLineIds.includes(row.id)}
                        onChange={(e) =>
                          setSelectedLineIds((prev) =>
                            e.target.checked
                              ? [...prev, row.id]
                              : prev.filter((id) => id !== row.id),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => delMut.mutate(row.id)}
                        className="touch-manipulation shrink-0 rounded-lg p-2 text-[#94A3B8] hover:bg-red-50 hover:text-red-500"
                        title="Delete line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {visibleColumns.file ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          File
                        </p>
                        <p className="mt-0.5 text-sm font-medium leading-snug text-[#0F172A]">
                          {row.fileName}
                        </p>
                        <p className="text-xs text-[#94A3B8]">Version {row.fileVersion}</p>
                      </div>
                    ) : null}
                    {visibleColumns.item ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Item
                        </p>
                        <p className="mt-0.5 text-sm text-[#0F172A]">{itemLabel}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {visibleColumns.qty ? (
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Quantity
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              defaultValue={row.quantity}
                              key={`m-${row.id}-${row.quantity}`}
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                if (!next || next === row.quantity) return;
                                patchMut.mutate({ id: row.id, quantity: next });
                              }}
                              className="min-h-[44px] w-full max-w-[11rem] rounded-lg border border-[#E2E8F0] px-3 py-2 text-right tabular-nums text-sm"
                              spellCheck={false}
                              suppressHydrationWarning
                            />
                            {patchMut.isPending && patchMut.variables?.id === row.id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#94A3B8]" />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {visibleColumns.unit ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Unit
                          </p>
                          <p className="mt-1 text-sm tabular-nums text-[#334155]">{row.unit}</p>
                        </div>
                      ) : null}
                      {visibleColumns.rate ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Rate
                          </p>
                          <p className="mt-1 text-sm tabular-nums text-[#334155]">
                            {row.material?.unitPrice != null
                              ? Number(row.material.unitPrice).toFixed(2)
                              : "—"}
                          </p>
                        </div>
                      ) : null}
                      {visibleColumns.gross ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Gross
                          </p>
                          <p className="mt-1 text-sm tabular-nums text-[#334155]">
                            {lineGross(row).toFixed(2)}
                          </p>
                        </div>
                      ) : null}
                      {visibleColumns.disc ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Disc %
                          </p>
                          <p className="mt-1 text-sm tabular-nums text-[#334155]">
                            {lineItemDiscPct(row, itemDiscountPctByKey).toFixed(2)}
                          </p>
                        </div>
                      ) : null}
                      {visibleColumns.net ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Net
                          </p>
                          <p className="mt-1 text-base font-semibold tabular-nums text-[#0F172A]">
                            {lineNetAfterItemDisc(row, itemDiscountPctByKey).toFixed(2)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {visibleColumns.tags ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Tags
                        </p>
                        <p className="mt-1 text-sm text-[#64748B]">
                          {(row.tags ?? []).length ? (row.tags ?? []).join(", ") : "—"}
                        </p>
                      </div>
                    ) : null}
                    {visibleColumns.notes ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Notes
                        </p>
                        <p className="mt-1 text-sm text-[#64748B]">{row.notes || "—"}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {visibleColumns.sheet ? (
                        row.sourceZoneId?.trim() ? (
                          <Link
                            href={viewerHrefForTakeoffLine(row)}
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            Open on sheet
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                          </Link>
                        ) : (
                          <span
                            className="inline-block rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]"
                            title="Added from the takeoff page catalog — not linked to a shape on a sheet"
                          >
                            Added manually
                          </span>
                        )
                      ) : null}
                      {visibleColumns.mismatch ? (
                        row.revisionMismatch ? (
                          <span
                            className="inline-block rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800"
                            title={`Line was created from v${row.sourceFileVersionAtCreate ?? "?"}; latest is v${row.latestFileVersion ?? row.fileVersion}.`}
                          >
                            Revision mismatch
                          </span>
                        ) : (
                          <span className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#64748B]">
                            Revision OK
                          </span>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B] shadow-[0_1px_0_#E2E8F0]">
                  <th className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={
                        tableLinesForRender.length > 0 &&
                        selectedLineIds.length === tableLinesForRender.length
                      }
                      onChange={(e) =>
                        setSelectedLineIds(
                          e.target.checked ? tableLinesForRender.map((r) => r.id) : [],
                        )
                      }
                    />
                  </th>
                  <th className={`px-4 py-3 ${visibleColumns.file ? "" : "hidden"}`}>File</th>
                  <th className={`px-4 py-3 ${visibleColumns.item ? "" : "hidden"}`}>Item</th>
                  <th className={`px-4 py-3 text-right ${visibleColumns.qty ? "" : "hidden"}`}>
                    Qty
                  </th>
                  <th className={`px-4 py-3 ${visibleColumns.unit ? "" : "hidden"}`}>Unit</th>
                  <th className={`px-4 py-3 text-right ${visibleColumns.rate ? "" : "hidden"}`}>
                    Rate
                  </th>
                  <th className={`px-4 py-3 text-right ${visibleColumns.gross ? "" : "hidden"}`}>
                    Gross
                  </th>
                  <th className={`px-4 py-3 text-right ${visibleColumns.disc ? "" : "hidden"}`}>
                    Disc %
                  </th>
                  <th className={`px-4 py-3 text-right ${visibleColumns.net ? "" : "hidden"}`}>
                    Net
                  </th>
                  <th className={`px-4 py-3 ${visibleColumns.tags ? "" : "hidden"}`}>Tags</th>
                  <th className={`px-4 py-3 ${visibleColumns.notes ? "" : "hidden"}`}>Notes</th>
                  <th className={`px-4 py-3 ${visibleColumns.sheet ? "" : "hidden"}`}>Sheet</th>
                  <th className={`px-4 py-3 ${visibleColumns.mismatch ? "" : "hidden"}`}>
                    Revision
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-[#64748B]">
                      <p className="mx-auto max-w-lg">
                        No takeoff lines yet. Open a drawing from{" "}
                        <Link
                          href={projectFilesHref}
                          className="font-semibold text-[#2563EB] hover:underline"
                        >
                          Files &amp; Drawings
                        </Link>
                        , use the Takeoff tool, finish a shape, then press{" "}
                        <strong className="font-semibold text-[#334155]">Save</strong> in the
                        takeoff panel. Each save syncs one line here.
                      </p>
                      <p className="mx-auto mt-3 max-w-lg text-xs text-[#94A3B8]">
                        Refresh if you just saved, and confirm this page is for the same project as
                        the sheet.
                      </p>
                    </td>
                  </tr>
                ) : tableLinesForRender.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-[#64748B]">
                      No lines match your search or tag filter.{" "}
                      <button
                        type="button"
                        className="font-semibold text-[#2563EB] hover:underline"
                        onClick={() => {
                          setLineSearch("");
                          setTagFilter(null);
                          setFileFilter(null);
                          setShowOnlyManual(false);
                        }}
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  tableLinesForRender.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#E2E8F0]/80 transition-colors duration-150 hover:bg-[#F8FAFC] ${
                        highlightedRowIds.includes(row.id) ? "bg-emerald-50" : ""
                      }`}
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedLineIds.includes(row.id)}
                          onChange={(e) =>
                            setSelectedLineIds((prev) =>
                              e.target.checked
                                ? [...prev, row.id]
                                : prev.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                      <td
                        className={`max-w-[180px] px-4 py-3 text-[#0F172A] ${visibleColumns.file ? "" : "hidden"}`}
                      >
                        <span className="line-clamp-2 font-medium">{row.fileName}</span>
                        <span className="block text-[11px] text-[#94A3B8]">v{row.fileVersion}</span>
                      </td>
                      <td
                        className={`max-w-[220px] px-4 py-3 text-[#0F172A] ${visibleColumns.item ? "" : "hidden"}`}
                      >
                        {row.material
                          ? `${row.material.categoryName} — ${row.material.name}`
                          : row.label || "—"}
                      </td>
                      <td className={`px-4 py-3 text-right ${visibleColumns.qty ? "" : "hidden"}`}>
                        <input
                          defaultValue={row.quantity}
                          key={`${row.id}-${row.quantity}`}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (!next || next === row.quantity) return;
                            patchMut.mutate({ id: row.id, quantity: next });
                          }}
                          className="w-24 rounded-md border border-[#E2E8F0] px-2 py-1 text-right tabular-nums"
                          spellCheck={false}
                          suppressHydrationWarning
                        />
                        {patchMut.isPending && patchMut.variables?.id === row.id ? (
                          <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-[#94A3B8]" />
                        ) : null}
                      </td>
                      <td
                        className={`px-4 py-3 text-[#64748B] ${visibleColumns.unit ? "" : "hidden"}`}
                      >
                        {row.unit}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-[#64748B] ${visibleColumns.rate ? "" : "hidden"}`}
                      >
                        {row.material?.unitPrice != null
                          ? Number(row.material.unitPrice).toFixed(2)
                          : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-[#64748B] ${visibleColumns.gross ? "" : "hidden"}`}
                      >
                        {lineGross(row).toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-[#64748B] ${visibleColumns.disc ? "" : "hidden"}`}
                      >
                        {lineItemDiscPct(row, itemDiscountPctByKey).toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium text-[#0F172A] ${visibleColumns.net ? "" : "hidden"}`}
                      >
                        {lineNetAfterItemDisc(row, itemDiscountPctByKey).toFixed(2)}
                      </td>
                      <td
                        className={`max-w-[140px] px-4 py-3 text-[#64748B] ${visibleColumns.tags ? "" : "hidden"}`}
                      >
                        <span className="line-clamp-2 text-xs">
                          {(row.tags ?? []).length ? (row.tags ?? []).join(", ") : "—"}
                        </span>
                      </td>
                      <td
                        className={`max-w-[200px] px-4 py-3 text-[#64748B] ${visibleColumns.notes ? "" : "hidden"}`}
                      >
                        <span className="line-clamp-2">{row.notes || "—"}</span>
                      </td>
                      <td className={`px-4 py-3 ${visibleColumns.sheet ? "" : "hidden"}`}>
                        {row.sourceZoneId?.trim() ? (
                          <Link
                            href={viewerHrefForTakeoffLine(row)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                          </Link>
                        ) : (
                          <span
                            className="inline-block rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]"
                            title="Added from the takeoff page catalog — not linked to a shape on a sheet"
                          >
                            Added manually
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 ${visibleColumns.mismatch ? "" : "hidden"}`}>
                        {row.revisionMismatch ? (
                          <span
                            className="inline-block rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700"
                            title={`Line was created from v${row.sourceFileVersionAtCreate ?? "?"}; latest is v${row.latestFileVersion ?? row.fileVersion}.`}
                          >
                            Mismatch
                          </span>
                        ) : (
                          <span className="text-xs text-[#64748B]">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => delMut.mutate(row.id)}
                          className="rounded-md p-1 text-[#94A3B8] hover:bg-red-50 hover:text-red-500"
                          title="Delete line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {lines.length > 0 ? (
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-sm font-medium leading-relaxed text-[#64748B] sm:px-4">
              {tagFilter || lineSearch.trim()
                ? `Showing ${tableLines.length} of ${lines.length} lines`
                : `Total lines: ${lines.length}`}
              {tableLines.length > tableLinesForRender.length ? (
                <span className="mt-1 block text-xs text-[#94A3B8] sm:ml-2 sm:mt-0 sm:inline">
                  (rendering first {tableLinesForRender.length} rows for performance)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {syncPreview ? (
        <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-[#1D4ED8]">Sync preview</p>
          <p className="mt-1 text-xs leading-relaxed text-[#334155]">
            Added {syncPreview.counts.added}, updated {syncPreview.counts.updated}, removed{" "}
            {syncPreview.counts.removed}.
          </p>
          <div className="mt-3 flex flex-col gap-3 text-xs sm:flex-row sm:flex-wrap sm:items-center">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="syncMode"
                checked={syncMode === "merge"}
                onChange={() => setSyncMode("merge")}
              />
              Merge
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="syncMode"
                checked={syncMode === "replace"}
                onChange={() => setSyncMode("replace")}
              />
              Replace
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={protectManualEdits}
                onChange={(e) => setProtectManualEdits(e.target.checked)}
              />
              Protect manual lines
            </label>
            <button
              type="button"
              onClick={() => syncApplyMut.mutate({ mode: syncMode, protectManualEdits })}
              className="touch-manipulation min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2.5 font-semibold text-white sm:min-h-0 sm:rounded-md sm:py-1.5"
            >
              Apply sync
            </button>
            <button
              type="button"
              onClick={() => setSyncPreview(null)}
              className="touch-manipulation min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white px-4 py-2.5 font-semibold text-[#334155] sm:min-h-0 sm:rounded-md sm:py-1.5"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {syncHistoryOpen ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-[#0F172A]">Sync history</p>
          <div className="mt-2 space-y-2">
            {(takeoffSyncHistory as TakeoffSyncHistoryRow[]).slice(0, 10).map((h) => (
              <div
                key={h.id}
                className="rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155]"
              >
                {h.mode} · +{h.addedCount} / ~{h.updatedCount} / -{h.removedCount} ·{" "}
                {new Date(h.createdAt).toLocaleString()} · {h.actor?.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <TakeoffMaterialsSlider
        open={materialsSliderOpen}
        onClose={() => setMaterialsSliderOpen(false)}
        workspaceId={workspaceId ?? null}
        materials={hubMaterials}
        materialsLoading={hubMaterialsLoading}
        materialsError={hubMaterialsError}
        onAddMaterial={(id) => addCatalogToCostingMut.mutate(id)}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:flex-row sm:items-center sm:gap-4">
        <Ruler className="h-5 w-5 shrink-0 text-[#2563EB]" />
        <p className="text-sm leading-relaxed text-[#1E40AF]">
          Calibrate drawing scale in the viewer before relying on measurements for quantities.
        </p>
      </div>
    </div>
  );
}

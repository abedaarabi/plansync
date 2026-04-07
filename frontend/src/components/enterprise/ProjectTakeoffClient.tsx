"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Download,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  Ruler,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  createProjectTakeoffLineFromMaterial,
  deleteTakeoffLine,
  fetchMaterials,
  fetchProject,
  fetchTakeoffLinesForProject,
  patchProject,
  patchTakeoffLine,
  type ProjectMeta,
  type TakeoffLineRow,
  ProRequiredError,
  viewerHrefForTakeoffLine,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { PROJECT_TAKEOFF_INVALIDATE_CHANNEL } from "@/lib/takeoffPublishCloud";

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
  const [materialHubSearch, setMaterialHubSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [lineSearch, setLineSearch] = useState("");
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

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(PROJECT_TAKEOFF_INVALIDATE_CHANNEL);
    bc.onmessage = (ev: MessageEvent<{ projectId?: string }>) => {
      if (ev.data?.projectId === projectId) {
        void qc.invalidateQueries({ queryKey: takeoffKey });
      }
    };
    return () => bc.close();
  }, [projectId, qc, takeoffKey]);
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

  const filteredHubMaterials = useMemo(() => {
    const q = materialHubSearch.trim().toLowerCase();
    if (!q) return hubMaterials;
    return hubMaterials.filter((m) => {
      const hay = `${m.category.name} ${m.name} ${m.sku ?? ""} ${m.unit}`.toLowerCase();
      return hay.includes(q);
    });
  }, [hubMaterials, materialHubSearch]);

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
    if (!tagFilter) return lines;
    return lines.filter((r) => (r.tags ?? []).includes(tagFilter));
  }, [lines, tagFilter]);

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
    <div className="space-y-6">
      <header className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#BFDBFE]/80"
              aria-hidden
            >
              <Ruler className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-[1.65rem]">
                Quantity Takeoff
              </h1>
              {project?.name ? (
                <p className="mt-1 truncate text-sm text-[#64748B]" title={project.name}>
                  {project.name}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
            <button
              type="button"
              onClick={exportCsv}
              disabled={lines.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F8FAFC] disabled:opacity-40"
            >
              <Download className="h-4 w-4 text-[#64748B]" strokeWidth={1.75} />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={1.75} />
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Browse workspace materials</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">
                Search your workspace catalog. Use{" "}
                <strong className="font-medium text-[#334155]">Add to costing</strong> to put a
                material on the takeoff list and into{" "}
                <strong className="font-medium text-[#334155]">Costing and discounts</strong>{" "}
                (default quantity 1 — edit qty in the table below). The project needs at least one
                uploaded file so lines can be stored.
              </p>
            </div>
          </div>
        </div>
        {!workspaceId ? (
          <p className="text-sm text-[#64748B]">Loading workspace…</p>
        ) : hubMaterialsLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading materials from library…
          </div>
        ) : hubMaterialsError ? (
          <p className="text-sm text-red-700">
            Could not load materials. Refresh the page or check your connection.
          </p>
        ) : (
          <>
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                type="search"
                value={materialHubSearch}
                onChange={(e) => setMaterialHubSearch(e.target.value)}
                placeholder="Search name, type, SKU, unit…"
                className="w-full rounded-md border border-[#E2E8F0] py-2 pl-9 pr-3 text-sm"
                spellCheck={false}
                autoComplete="off"
                aria-label="Search materials library"
              />
            </div>
            {hubMaterials.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-sm text-[#64748B]">
                No materials in this workspace yet. Ask a workspace admin to add items to the
                catalog.
              </p>
            ) : (
              <>
                <ul
                  className="max-h-56 divide-y divide-[#F1F5F9] overflow-y-auto rounded-md border border-[#E2E8F0] [scrollbar-width:thin]"
                  aria-label="Workspace materials"
                >
                  {filteredHubMaterials.slice(0, 100).map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#0F172A]">{m.name}</p>
                        <p className="truncate text-xs text-[#64748B]">
                          {m.category.name}
                          {m.sku ? ` · ${m.sku}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-[#334155]">
                          <span className="text-[#64748B]">{m.unit}</span>
                          {m.unitPrice != null && m.unitPrice !== "" ? (
                            <>
                              {" "}
                              · {m.currency} {m.unitPrice}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={addCatalogToCostingMut.isPending}
                        onClick={() => addCatalogToCostingMut.mutate(m.id)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] transition hover:bg-[#DBEAFE] disabled:opacity-50"
                      >
                        {addCatalogToCostingMut.isPending &&
                        addCatalogToCostingMut.variables === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                        )}
                        Add to costing
                      </button>
                    </li>
                  ))}
                </ul>
                {filteredHubMaterials.length > 100 ? (
                  <p className="mt-2 text-xs text-[#64748B]">
                    Showing 100 of {filteredHubMaterials.length}. Refine your search to find more.
                  </p>
                ) : null}
                {filteredHubMaterials.length === 0 && hubMaterials.length > 0 ? (
                  <p className="mt-2 text-sm text-[#64748B]">No matches — try another search.</p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-sm font-semibold text-[#0F172A]">Costing and discounts</h2>
        </div>
        <p className="mb-2 text-xs text-[#64748B]">
          Item and project discounts save automatically to the project. Line totals below use item
          discount %; the project discount applies once on the subtotal.
        </p>
        <div className="space-y-2">
          {pricing.itemRows.length > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_90px_120px_120px] items-end gap-2 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              <span>Item</span>
              <span className="text-right">Disc %</span>
              <span className="text-right">Discount</span>
              <span className="text-right">Net</span>
            </div>
          ) : null}
          {pricing.itemRows.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-[minmax(0,1fr)_90px_120px_120px] items-center gap-2 rounded-md border border-[#E2E8F0] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#0F172A]">{r.label}</p>
                <p className="text-xs text-[#64748B]">
                  Qty {r.qty.toFixed(2)} {r.unit} × Rate {r.rate.toFixed(2)} {r.currency}
                </p>
              </div>
              <input
                value={itemDiscountPctByKey[r.key] ?? "0"}
                onChange={(e) =>
                  setItemDiscountPctByKey((prev) => ({ ...prev, [r.key]: e.target.value }))
                }
                className="rounded-md border border-[#E2E8F0] px-2 py-1 text-right tabular-nums"
                title="Item discount %"
                spellCheck={false}
                suppressHydrationWarning
              />
              <span className="text-right tabular-nums text-[#64748B]">
                -{r.discount.toFixed(2)}
              </span>
              <span className="text-right tabular-nums font-semibold text-[#0F172A]">
                {r.net.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-end gap-3 text-sm">
            <label className="text-[#64748B]">Project discount %</label>
            <input
              value={projectDiscountPct}
              onChange={(e) => setProjectDiscountPct(e.target.value)}
              className="w-24 rounded-md border border-[#E2E8F0] px-2 py-1 text-right tabular-nums"
            />
          </div>
          <div className="mt-3 grid gap-1 text-sm text-[#334155]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Item discounts</span>
              <span className="tabular-nums">-{pricing.itemDiscountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Project discount ({pricing.projectDiscPct.toFixed(2)}%)</span>
              <span className="tabular-nums">-{pricing.projectDiscount.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[#E2E8F0] pt-2 text-base font-semibold text-[#0F172A]">
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
        <div
          className="overflow-hidden border border-[#E2E8F0] bg-white"
          style={{
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          {lines.length > 0 ? (
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                By sheet (net of item discount %)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {totalsBySheet.map((s) => (
                  <span
                    key={s.fileId}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155]"
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
              <div className="mt-2 flex flex-wrap gap-2">
                {totalsByPrimaryTag.map(([tag, total]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155]"
                  >
                    <span className="font-medium text-[#0F172A]">{tag}</span>
                    <span className="tabular-nums text-[#64748B]">{total.toFixed(2)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#64748B]">Filter by tag:</span>
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
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
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      tagFilter === t
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                        : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
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
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B] shadow-[0_1px_0_#E2E8F0]">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Disc %</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Sheet</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-[#64748B]">
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
                ) : tableLines.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-[#64748B]">
                      No lines match your search or tag filter.{" "}
                      <button
                        type="button"
                        className="font-semibold text-[#2563EB] hover:underline"
                        onClick={() => {
                          setLineSearch("");
                          setTagFilter(null);
                        }}
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  tableLines.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#E2E8F0]/80 transition-colors duration-150 hover:bg-[#F8FAFC]"
                    >
                      <td className="max-w-[180px] px-4 py-3 text-[#0F172A]">
                        <span className="line-clamp-2 font-medium">{row.fileName}</span>
                        <span className="block text-[11px] text-[#94A3B8]">v{row.fileVersion}</span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-[#0F172A]">
                        {row.material
                          ? `${row.material.categoryName} — ${row.material.name}`
                          : row.label || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      <td className="px-4 py-3 text-[#64748B]">{row.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#64748B]">
                        {row.material?.unitPrice != null
                          ? Number(row.material.unitPrice).toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#64748B]">
                        {lineGross(row).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#64748B]">
                        {lineItemDiscPct(row, itemDiscountPctByKey).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-[#0F172A]">
                        {lineNetAfterItemDisc(row, itemDiscountPctByKey).toFixed(2)}
                      </td>
                      <td className="max-w-[140px] px-4 py-3 text-[#64748B]">
                        <span className="line-clamp-2 text-xs">
                          {(row.tags ?? []).length ? (row.tags ?? []).join(", ") : "—"}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-[#64748B]">
                        <span className="line-clamp-2">{row.notes || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
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
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#64748B]">
              {tagFilter || lineSearch.trim()
                ? `Showing ${tableLines.length} of ${lines.length} lines`
                : `Total lines: ${lines.length}`}
            </div>
          ) : null}
        </div>
      )}

      <div
        className="flex items-center gap-3 border border-blue-100 bg-blue-50/50 px-4 py-3"
        style={{ borderRadius: "12px" }}
      >
        <Ruler className="h-5 w-5 shrink-0 text-[#2563EB]" />
        <p className="text-sm text-[#1E40AF]">
          Calibrate drawing scale in the viewer before relying on measurements for quantities.
        </p>
      </div>
    </div>
  );
}

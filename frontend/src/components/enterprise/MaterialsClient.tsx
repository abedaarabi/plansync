"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Package,
  Pencil,
  Plus,
  Copy,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  createMaterial,
  deleteMaterial,
  downloadMaterialsTemplate,
  fetchMaterialCategories,
  fetchMaterialsPaged,
  importMaterialsExcel,
  patchMaterial,
  ProRequiredError,
  type MaterialRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { isProSubscriptionStatus } from "@/lib/proWorkspace";

function formatMoney(amount: string | null, currency: string): string {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

type FormState = {
  materialType: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: string;
  currency: string;
  supplier: string;
  manufacturer: string;
  specification: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  materialType: "",
  name: "",
  sku: "",
  unit: "ea",
  unitPrice: "",
  currency: "USD",
  supplier: "",
  manufacturer: "",
  specification: "",
  notes: "",
});

function rowToForm(m: MaterialRow): FormState {
  return {
    materialType: m.category.name,
    name: m.name,
    sku: m.sku ?? "",
    unit: m.unit,
    unitPrice: m.unitPrice ?? "",
    currency: m.currency,
    supplier: m.supplier ?? "",
    manufacturer: m.manufacturer ?? "",
    specification: m.specification ?? "",
    notes: m.notes ?? "",
  };
}

export function MaterialsClient({ workspaceId: forcedWorkspaceId }: { workspaceId?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { me, primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const [workspaceId, setWorkspaceId] = useState<string>(
    forcedWorkspaceId ?? primary?.workspace.id ?? "",
  );
  const memberships = me?.workspaces ?? [];

  const selectedMembership =
    memberships.find((m) => m.workspace.id === workspaceId) ?? primary ?? null;
  const wid = forcedWorkspaceId ?? selectedMembership?.workspace.id;
  const isPro = isProSubscriptionStatus(selectedMembership?.workspace.subscriptionStatus);

  useEffect(() => {
    if (!forcedWorkspaceId && primary?.workspace.id && !workspaceId) {
      setWorkspaceId(primary.workspace.id);
    }
  }, [forcedWorkspaceId, primary?.workspace.id, workspaceId]);

  useEffect(() => {
    if (!forcedWorkspaceId && wid && pathname.startsWith("/materials")) {
      router.replace(`/workspaces/${wid}/materials`);
    }
  }, [forcedWorkspaceId, pathname, router, wid]);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedQ, wid]);

  const {
    data: paged,
    isPending,
    isFetching,
    error,
  } = useQuery({
    queryKey: qk.materialsPaged(
      wid ?? "",
      page,
      pageSize,
      debouncedQ,
      typeFilter === "all" ? "" : typeFilter,
    ),
    queryFn: () =>
      fetchMaterialsPaged(wid!, {
        page,
        pageSize,
        q: debouncedQ || undefined,
        categoryId: typeFilter === "all" ? undefined : typeFilter,
      }),
    enabled: Boolean(wid && isPro),
    placeholderData: (prev) => prev,
  });
  const materials = paged?.items ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: qk.materialCategories(wid ?? ""),
    queryFn: () => fetchMaterialCategories(wid!),
    enabled: Boolean(wid && isPro),
  });

  const loadError =
    error instanceof ProRequiredError
      ? "Materials library requires an active Pro subscription."
      : error instanceof Error
        ? error.message
        : null;

  const types = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((c) => ({ id: c.id, name: c.name }));
  }, [categories]);

  const invalidate = () => {
    if (!wid) return;
    void queryClient.invalidateQueries({ queryKey: qk.materials(wid) });
    void queryClient.invalidateQueries({ queryKey: ["materialsPaged", wid], exact: false });
    void queryClient.invalidateQueries({ queryKey: qk.materialCategories(wid) });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!wid) throw new Error("No workspace");
      const body = {
        materialType: form.materialType.trim(),
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit.trim() || "ea",
        unitPrice: form.unitPrice.trim() ? form.unitPrice.replace(/,/g, "") : null,
        currency: form.currency.trim() || "USD",
        supplier: form.supplier.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        specification: form.specification.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        return patchMaterial(wid, editing.id, body);
      }
      return createMaterial(wid, body);
    },
    onSuccess: () => {
      toast.success(editing ? "Material updated" : "Material added");
      setPanelOpen(false);
      setEditing(null);
      setForm(emptyForm());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!wid) throw new Error("No workspace");
      await deleteMaterial(wid, id);
    },
    onSuccess: () => {
      toast.success("Material removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onDownloadTemplate() {
    if (!wid) return;
    try {
      await downloadMaterialsTemplate(wid);
      toast.success("Template downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  function onPickImport() {
    fileRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !wid) return;
    try {
      const r = await importMaterialsExcel(wid, file);
      toast.success(`Import complete: ${r.created} added, ${r.updated} updated`);
      if (r.warnings?.length) {
        toast.message("Some rows had issues", { description: r.warnings.slice(0, 5).join("\n") });
      }
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  const loading = ctxLoading || (Boolean(wid && isPro) && isPending && !paged);

  if (loading) {
    return <EnterpriseLoadingState message="Loading materials…" label="Loading materials list" />;
  }

  if (!primary || !wid) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        Sign in and select a workspace.
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="enterprise-card border-amber-200/80 bg-amber-50/90 p-8 text-sm text-amber-950">
        <p className="font-semibold">Pro subscription required</p>
        <p className="mt-2 text-amber-900/90">
          The materials database is available on PlanSync Pro. Upgrade to build a shared catalog for
          your team.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="shrink-0 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
              <Package className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--enterprise-text)]">
              Materials database
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            <strong className="font-medium text-[var(--enterprise-text)]">
              Company-wide catalog:
            </strong>{" "}
            one list for the whole workspace — every project (quantity takeoff, estimates,
            procurement) draws from the same materials. Types are unique per company (e.g. one
            &quot;Concrete&quot;); add multiple line items under each type. Use Excel template +
            import to bulk update.
          </p>
          {memberships.length > 1 && !forcedWorkspaceId ? (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Workspace
              </label>
              <select
                value={wid}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
              >
                {memberships.map((m) => (
                  <option key={m.workspace.id} value={m.workspace.id}>
                    {m.workspace.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
          >
            <Download className="h-4 w-4" />
            Template (.xlsx)
          </button>
          <button
            type="button"
            onClick={onPickImport}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={onImportFile}
          />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm());
              setPanelOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            <Plus className="h-4 w-4" />
            Add material
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      <div className="enterprise-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="shrink-0 flex flex-col gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, SKU, supplier, spec…"
              className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-2 pl-10 pr-3 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)]/70 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            />
          </div>
          <div className="flex items-center gap-2">
            {isFetching ? (
              <span className="text-xs text-[var(--enterprise-text-muted)]">Refreshing…</span>
            ) : null}
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            >
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--enterprise-border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="w-24 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-[var(--enterprise-text-muted)]"
                  >
                    <FileSpreadsheet className="mx-auto h-10 w-10 opacity-40" />
                    <p className="mt-3 font-medium text-[var(--enterprise-text)]">
                      {debouncedQ || typeFilter !== "all"
                        ? "No matching materials"
                        : "No materials yet"}
                    </p>
                    <p className="mt-1 max-w-md mx-auto text-sm">
                      {debouncedQ || typeFilter !== "all"
                        ? "Try a different search term or clear filters."
                        : "Add a row manually, or download the Excel template and import your catalog."}
                    </p>
                  </td>
                </tr>
              ) : (
                materials.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--enterprise-border)]/60 transition hover:bg-[var(--enterprise-hover-surface)]/50"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg bg-[var(--enterprise-primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-primary)]">
                        {m.category.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate font-medium text-[var(--enterprise-text)]">
                          {m.name}
                        </div>
                        <button
                          type="button"
                          aria-label="Copy material name"
                          title="Copy material name"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(m.name)
                              .then(() => toast.success("Material name copied"))
                              .catch(() => toast.error("Could not copy material name"));
                          }}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {m.specification && (
                        <div className="truncate text-xs text-[var(--enterprise-text-muted)]">
                          {m.specification}
                        </div>
                      )}
                    </td>
                    <td className="truncate px-4 py-3 text-[var(--enterprise-text-muted)]">
                      {m.sku || "—"}
                    </td>
                    <td className="truncate px-4 py-3">{m.unit}</td>
                    <td className="truncate px-4 py-3 tabular-nums">
                      {formatMoney(m.unitPrice, m.currency)}
                    </td>
                    <td className="truncate px-4 py-3 text-[var(--enterprise-text-muted)]">
                      {m.supplier || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(m);
                          setForm(rowToForm(m));
                          setPanelOpen(true);
                        }}
                        className="inline-flex rounded-lg p-2 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Remove “${m.name}” from the catalog?`)) return;
                          deleteMutation.mutate(m.id);
                        }}
                        className="inline-flex rounded-lg p-2 text-[var(--enterprise-text-muted)] transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-2 text-xs text-[var(--enterprise-text-muted)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing {paged && paged.total > 0 ? (paged.page - 1) * paged.pageSize + 1 : 0}-
              {paged && paged.total > 0 ? Math.min(paged.page * paged.pageSize, paged.total) : 0} of{" "}
              {paged?.total ?? 0} materials
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!paged || paged.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-[var(--enterprise-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {paged?.page ?? 1} / {paged?.totalPages ?? 1}
              </span>
              <button
                type="button"
                disabled={!paged || paged.page >= paged.totalPages}
                onClick={() => setPage((p) => (paged ? Math.min(paged.totalPages, p + 1) : p))}
                className="rounded border border-[var(--enterprise-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <EnterpriseSlideOver
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditing(null);
        }}
        ariaLabelledBy="materials-panel-title"
        form={{
          onSubmit: (e) => {
            e.preventDefault();
            saveMutation.mutate();
          },
        }}
        header={
          <div>
            <h2
              id="materials-panel-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              {editing ? "Edit material" : "Add material"}
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Types merge by name (case-insensitive). Same type + name updates one row.
            </p>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
                setEditing(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add material"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Material type <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.materialType}
              onChange={(e) => setForm((f) => ({ ...f, materialType: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              placeholder="e.g. Concrete, Structural Steel, Finishes"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Material name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              placeholder="e.g. Ready-mix 25 MPa"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              placeholder="m³, kg, sf, ea…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Unit price
            </label>
            <input
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Currency
            </label>
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              placeholder="USD"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Supplier
            </label>
            <input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Manufacturer
            </label>
            <input
              value={form.manufacturer}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Specification
            </label>
            <input
              value={form.specification}
              onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              placeholder="ASTM, grade, mix design…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </EnterpriseSlideOver>
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FileSpreadsheet,
  HelpCircle,
  LayoutList,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createMaterial,
  deleteMaterial,
  downloadMaterialsTemplate,
  fetchMaterialCategories,
  fetchMaterialTemplate,
  fetchMaterialsPaged,
  importMaterialsExcel,
  patchMaterial,
  ProRequiredError,
  type MaterialRow,
  type MaterialTemplateField,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { MaterialTemplateEditor } from "./MaterialTemplateEditor";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

const materialInputClass =
  "mt-1 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition placeholder:text-[var(--enterprise-text-muted)]/50 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/15";

const MATERIALS_CATALOG_HELP =
  'Company-wide catalog: one list for the whole workspace — every project (quantity takeoff, estimates, procurement) draws from the same materials. Types are unique per company (e.g. one "Concrete"); add multiple line items under each type. Use Excel template + import to bulk update. After a super admin changes catalog fields, download a fresh template so columns stay in sync.';

function formatCustomCell(m: MaterialRow, f: MaterialTemplateField): string {
  const v = m.customAttributes?.[f.key];
  if (v == null || v === "") return "—";
  if (f.type === "currency") {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : String(v);
  }
  if (f.type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
  }
  const s = String(v);
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

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
  custom: Record<string, string>;
};

function emptyForm(customKeys: string[]): FormState {
  const custom: Record<string, string> = {};
  for (const k of customKeys) custom[k] = "";
  return {
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
    custom,
  };
}

function rowToForm(m: MaterialRow, fieldKeys: MaterialTemplateField[]): FormState {
  const custom: Record<string, string> = {};
  for (const f of fieldKeys) {
    const v = m.customAttributes?.[f.key];
    custom[f.key] = v == null ? "" : String(v);
  }
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
    custom,
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
  const isPro = isWorkspaceProClient(selectedMembership?.workspace);
  const isSuperAdmin = selectedMembership?.role === "SUPER_ADMIN";

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
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [catalogHelpOpen, setCatalogHelpOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm([]));
  const fileRef = useRef<HTMLInputElement>(null);
  const catalogHelpRef = useRef<HTMLDivElement>(null);
  const catalogHelpDescriptionId = useId();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedQ, wid]);

  useEffect(() => {
    if (!catalogHelpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatalogHelpOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const el = catalogHelpRef.current;
      if (el && !el.contains(e.target as Node)) setCatalogHelpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [catalogHelpOpen]);

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

  const { data: materialTemplate } = useQuery({
    queryKey: qk.materialTemplate(wid ?? ""),
    queryFn: () => fetchMaterialTemplate(wid!),
    enabled: Boolean(wid && isPro),
  });

  const sortedTplFields = useMemo(() => {
    return [...(materialTemplate?.fields ?? [])].sort(
      (a, b) =>
        a.order - b.order || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [materialTemplate?.fields]);

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
      const customAttributes: Record<string, unknown> = {};
      for (const f of sortedTplFields) {
        const raw = (form.custom[f.key] ?? "").trim();
        if (f.type === "number") {
          customAttributes[f.key] = raw === "" ? null : Number(raw.replace(/,/g, ""));
        } else if (f.type === "currency") {
          customAttributes[f.key] = raw === "" ? null : raw.replace(/,/g, "");
        } else {
          customAttributes[f.key] = raw === "" ? null : raw;
        }
      }
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
        customAttributes,
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
      setForm(emptyForm(sortedTplFields.map((f) => f.key)));
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
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/12">
              <Package className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--enterprise-text)]">
                Materials database
              </h1>
              <div ref={catalogHelpRef} className="relative inline-flex">
                <button
                  type="button"
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 ${catalogHelpOpen ? "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-primary)]" : ""}`}
                  aria-label="How the materials catalog works"
                  aria-expanded={catalogHelpOpen}
                  aria-controls={catalogHelpOpen ? catalogHelpDescriptionId : undefined}
                  onClick={() => setCatalogHelpOpen((o) => !o)}
                >
                  <HelpCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </button>
                {catalogHelpOpen ? (
                  <div
                    id={catalogHelpDescriptionId}
                    role="region"
                    aria-label="Materials catalog help"
                    className="absolute left-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 text-sm leading-relaxed text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-floating)] ring-1 ring-black/5 dark:ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[var(--enterprise-text)]">
                        {MATERIALS_CATALOG_HELP}
                      </p>
                      <button
                        type="button"
                        aria-label="Close help"
                        onClick={() => setCatalogHelpOpen(false)}
                        className="shrink-0 rounded-lg p-1 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                      >
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 p-1.5 shadow-[var(--enterprise-shadow-xs)]">
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => setTemplatePanelOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]/80"
              >
                <LayoutList className="h-4 w-4" strokeWidth={1.75} />
                Catalog fields
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Template
            </button>
            <button
              type="button"
              onClick={onPickImport}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Upload className="h-4 w-4" strokeWidth={1.75} />
              Import
            </button>
          </div>
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
              setForm(emptyForm(sortedTplFields.map((f) => f.key)));
              setPanelOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--enterprise-primary)]/20 transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add material
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      <div className="enterprise-card flex min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-[var(--enterprise-shadow-xs)]">
        <div className="shrink-0 flex flex-col gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div className="relative max-w-lg flex-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Search catalog
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, SKU, supplier, specification…"
                className="w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)]/55 focus:border-[var(--enterprise-primary)] focus:bg-[var(--enterprise-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/15"
              />
            </div>
            {sortedTplFields.length > 0 ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-[var(--enterprise-border)]/70 bg-[var(--enterprise-bg)]/50 px-2.5 py-2 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--enterprise-primary)]/70" />
                Custom columns are not included in search yet.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pb-0.5">
            {isFetching ? (
              <span className="text-xs font-medium text-[var(--enterprise-primary)]">
                Updating…
              </span>
            ) : null}
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Filter by type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/15"
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)] shadow-sm">
                <th className="whitespace-nowrap px-4 py-3.5">Type</th>
                <th className="min-w-[8rem] px-4 py-3.5">Material</th>
                <th className="px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Unit</th>
                <th className="px-4 py-3.5">Price</th>
                <th className="min-w-[6rem] px-4 py-3.5">Supplier</th>
                {sortedTplFields.map((f) => (
                  <th
                    key={f.id}
                    className={`max-w-40 truncate bg-[var(--enterprise-primary-soft)]/30 px-4 py-3.5 text-[var(--enterprise-text)] ring-1 ring-inset ring-[var(--enterprise-primary)]/10 first:pl-4 ${f.type === "number" || f.type === "currency" ? "text-right" : ""}`}
                    title={f.label}
                  >
                    {f.label}
                  </th>
                ))}
                <th className="w-28 whitespace-nowrap px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr>
                  <td
                    colSpan={7 + sortedTplFields.length}
                    className="px-4 py-16 text-center text-[var(--enterprise-text-muted)]"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)]/80 text-[var(--enterprise-primary)]">
                      <FileSpreadsheet className="h-7 w-7 opacity-90" strokeWidth={1.5} />
                    </div>
                    <p className="mt-4 font-semibold text-[var(--enterprise-text)]">
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
                    className="border-b border-[var(--enterprise-border)]/50 transition-colors hover:bg-[var(--enterprise-hover-surface)]/60"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <span className="inline-flex max-w-full truncate rounded-lg bg-[var(--enterprise-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/10">
                        {m.category.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
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
                    <td className="truncate px-4 py-3.5 align-middle text-[var(--enterprise-text-muted)]">
                      {m.sku || "—"}
                    </td>
                    <td className="truncate px-4 py-3.5 align-middle">{m.unit}</td>
                    <td className="truncate px-4 py-3.5 align-middle tabular-nums font-medium text-[var(--enterprise-text)]">
                      {formatMoney(m.unitPrice, m.currency)}
                    </td>
                    <td className="truncate px-4 py-3.5 align-middle text-[var(--enterprise-text-muted)]">
                      {m.supplier || "—"}
                    </td>
                    {sortedTplFields.map((f) => (
                      <td
                        key={f.id}
                        className={`max-w-40 truncate bg-[var(--enterprise-primary-soft)]/[0.12] px-4 py-3.5 align-middle text-[var(--enterprise-text)] ${f.type === "number" || f.type === "currency" ? "text-right tabular-nums" : ""}`}
                        title={formatCustomCell(m, f)}
                      >
                        {formatCustomCell(m, f)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(m);
                          setForm(rowToForm(m, sortedTplFields));
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
        <div className="shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/35 px-4 py-3 text-xs text-[var(--enterprise-text-muted)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">
              Showing {paged && paged.total > 0 ? (paged.page - 1) * paged.pageSize + 1 : 0}–
              {paged && paged.total > 0 ? Math.min(paged.page * paged.pageSize, paged.total) : 0} of{" "}
              <span className="tabular-nums text-[var(--enterprise-text)]">
                {paged?.total ?? 0}
              </span>{" "}
              materials
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!paged || paged.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-[5.5rem] text-center text-[11px] font-semibold tabular-nums text-[var(--enterprise-text)]">
                {paged?.page ?? 1} / {paged?.totalPages ?? 1}
              </span>
              <button
                type="button"
                disabled={!paged || paged.page >= paged.totalPages}
                onClick={() => setPage((p) => (paged ? Math.min(paged.totalPages, p + 1) : p))}
                className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
              {editing ? (
                <Pencil className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Plus className="h-5 w-5" strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="materials-panel-title"
                className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
              >
                {editing ? "Edit material" : "Add material"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                Types merge by name (case-insensitive). Same type + name updates one row.
              </p>
            </div>
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
              className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add material"}
            </button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Core details
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Material type <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.materialType}
              onChange={(e) => setForm((f) => ({ ...f, materialType: e.target.value }))}
              className={materialInputClass}
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
              className={materialInputClass}
              placeholder="e.g. Ready-mix 25 MPa"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className={materialInputClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className={materialInputClass}
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
              className={materialInputClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Currency
            </label>
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className={materialInputClass}
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
              className={materialInputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Manufacturer
            </label>
            <input
              value={form.manufacturer}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              className={materialInputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Specification
            </label>
            <input
              value={form.specification}
              onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))}
              className={materialInputClass}
              placeholder="ASTM, grade, mix design…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={materialInputClass}
            />
          </div>
          {sortedTplFields.length > 0 ? (
            <div className="sm:col-span-2 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/45 p-4 shadow-[var(--enterprise-shadow-xs)] ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
              <div className="flex items-center gap-2">
                <LayoutList
                  className="h-4 w-4 text-[var(--enterprise-primary)]"
                  strokeWidth={1.75}
                />
                <p className="text-xs font-semibold text-[var(--enterprise-text)]">
                  Custom properties
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
                Defined in Catalog fields. Values sync to Excel import/export.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sortedTplFields.map((f) => (
                  <div key={f.id} className={f.type === "text" ? "sm:col-span-2" : ""}>
                    <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                      {f.label}
                      {f.required ? <span className="text-red-500"> *</span> : null}
                    </label>
                    {f.type === "text" ? (
                      <input
                        value={form.custom[f.key] ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            custom: { ...prev.custom, [f.key]: e.target.value },
                          }))
                        }
                        className={materialInputClass}
                      />
                    ) : (
                      <input
                        value={form.custom[f.key] ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            custom: { ...prev.custom, [f.key]: e.target.value },
                          }))
                        }
                        inputMode="decimal"
                        className={`${materialInputClass} tabular-nums`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </EnterpriseSlideOver>

      {wid && isSuperAdmin ? (
        <MaterialTemplateEditor
          workspaceId={wid}
          open={templatePanelOpen}
          onClose={() => setTemplatePanelOpen(false)}
        />
      ) : null}
    </div>
  );
}

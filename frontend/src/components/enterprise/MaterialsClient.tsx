"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Download, HelpCircle, LayoutList, Package, Plus, Upload, X } from "lucide-react";
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
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { MaterialTemplateEditor } from "./MaterialTemplateEditor";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { OM_COMPACT_LABEL, OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { MaterialsKpiStrip } from "@/components/enterprise/materials/MaterialsKpiStrip";
import { MaterialsCatalogTable } from "@/components/enterprise/materials/MaterialsCatalogTable";
import { MaterialsFormSlideOver } from "@/components/enterprise/materials/MaterialsFormSlideOver";
import {
  buildMaterialPayload,
  emptyMaterialForm,
  MATERIALS_CATALOG_HELP,
  rowToMaterialForm,
  type MaterialFormState,
} from "@/components/enterprise/materials/materialsUtils";

// fallow-ignore-next-line complexity
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
  const isPro = isWorkspaceProPlusClient(selectedMembership?.workspace);
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
  const [form, setForm] = useState<MaterialFormState>(() => emptyMaterialForm([]));
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
      const body = buildMaterialPayload(form, sortedTplFields);
      if (editing) {
        return patchMaterial(wid, editing.id, body);
      }
      return createMaterial(wid, body);
    },
    onSuccess: () => {
      toast.success(editing ? "Material updated" : "Material added");
      setPanelOpen(false);
      setEditing(null);
      setForm(emptyMaterialForm(sortedTplFields.map((f) => f.key)));
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

  function openCreate() {
    setEditing(null);
    setForm(emptyMaterialForm(sortedTplFields.map((f) => f.key)));
    setPanelOpen(true);
  }

  function openEdit(m: MaterialRow) {
    setEditing(m);
    setForm(rowToMaterialForm(m, sortedTplFields));
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
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
      <PlanUpgradeCallout
        feature="Materials database"
        detail="Upgrade to Pro to build a shared catalog for takeoff and proposals."
      />
    );
  }

  const filtered = Boolean(debouncedQ) || typeFilter !== "all";

  return (
    <div className={`${OM_PAGE_CLASS} flex h-full min-h-0 w-full min-w-0 max-w-full flex-col`}>
      <OmSubPageHeader
        icon={Package}
        title="Materials database"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Company-wide catalog shared across projects.
            <span ref={catalogHelpRef} className="relative inline-flex">
              <button
                type="button"
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)] ${
                  catalogHelpOpen
                    ? "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-primary)]"
                    : ""
                }`}
                aria-label="How the materials catalog works"
                aria-expanded={catalogHelpOpen}
                aria-controls={catalogHelpOpen ? catalogHelpDescriptionId : undefined}
                onClick={() => setCatalogHelpOpen((o) => !o)}
              >
                <HelpCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
              {catalogHelpOpen ? (
                <div
                  id={catalogHelpDescriptionId}
                  role="region"
                  aria-label="Materials catalog help"
                  className="absolute left-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),22rem)] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 text-xs leading-relaxed text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-floating)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1">{MATERIALS_CATALOG_HELP}</p>
                    <button
                      type="button"
                      aria-label="Close help"
                      onClick={() => setCatalogHelpOpen(false)}
                      className="shrink-0 rounded-md p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
            </span>
          </span>
        }
        action={
          <>
            {isSuperAdmin ? (
              <EnterpriseButton
                size="sm"
                variant="secondary"
                onClick={() => setTemplatePanelOpen(true)}
              >
                <LayoutList className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Catalog fields
              </EnterpriseButton>
            ) : null}
            <EnterpriseButton size="sm" variant="secondary" onClick={onDownloadTemplate}>
              <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Template
            </EnterpriseButton>
            <EnterpriseButton size="sm" variant="secondary" onClick={onPickImport}>
              <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Import
            </EnterpriseButton>
            <EnterpriseButton size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Add material
            </EnterpriseButton>
          </>
        }
      >
        {memberships.length > 1 && !forcedWorkspaceId ? (
          <div className="flex items-center gap-2">
            <label className={OM_COMPACT_LABEL}>Workspace</label>
            <select
              value={wid}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className={OM_COMPACT_SELECT}
            >
              {memberships.map((m) => (
                <option key={m.workspace.id} value={m.workspace.id}>
                  {m.workspace.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </OmSubPageHeader>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={onImportFile}
      />

      {loadError ? (
        <div className="enterprise-alert-danger px-3.5 py-2.5 text-sm">{loadError}</div>
      ) : null}

      <MaterialsKpiStrip
        total={paged?.total ?? 0}
        typeCount={types.length}
        customFieldCount={sortedTplFields.length}
        filtered={filtered}
      />

      <MaterialsCatalogTable
        materials={materials}
        paged={paged}
        sortedTplFields={sortedTplFields}
        q={q}
        onQChange={setQ}
        debouncedQ={debouncedQ}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        types={types}
        isFetching={isFetching}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={(m) => {
          if (!confirm(`Remove “${m.name}” from the catalog?`)) return;
          deleteMutation.mutate(m.id);
        }}
        onAdd={openCreate}
        onDownloadTemplate={onDownloadTemplate}
        onPickImport={onPickImport}
      />

      <MaterialsFormSlideOver
        open={panelOpen}
        editing={Boolean(editing)}
        form={form}
        onFormChange={setForm}
        sortedTplFields={sortedTplFields}
        saving={saveMutation.isPending}
        onClose={closePanel}
        onSubmit={() => saveMutation.mutate()}
      />

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

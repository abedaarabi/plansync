"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Package, Plus, Search, Trash2, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createOmAsset,
  deleteOmAsset,
  deleteOmAssetImage,
  fetchOmAssets,
  fetchProjectSession,
  fetchProjects,
  omAssetRegisterCsvUrl,
  omOccupantAssetQrCsvUrl,
  patchOmAsset,
  uploadOmAssetImageFile,
  type OmAssetRow,
  ProRequiredError,
} from "@/lib/api-client";
import { filterOmAssets, type OmAssetsListFilter } from "@/lib/omAssetsOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { sortedVersions } from "@/components/file-explorer/fileExplorerUtils";
import { assetHasSheetPin } from "@/lib/assetPinFocus";
import { isPdfFile } from "@/lib/isPdfFile";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import {
  buildOmAssetViewerQuery,
  omAssetBimViewerHref,
  omAssetLinkedPdfFile,
  omAssetViewerMode,
} from "@/lib/omAssetViewerNavigation";
import { qk } from "@/lib/queryKeys";
import type { CloudFile, FileVersion } from "@/types/projects";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetDetailSlide } from "@/components/enterprise/OmAssetDetailSlide";
import { OmAssetDocumentsBlock } from "@/components/enterprise/OmAssetDocumentsBlock";
import {
  assetDraftFromRow,
  assetDraftToCreateBody,
  assetDraftToPatchBody,
  emptyAssetDraft,
  OmAssetFormFields,
  type AssetFormDraft,
} from "@/components/enterprise/OmAssetFormFields";
import { OmAssetsOverview } from "@/components/enterprise/OmAssetsOverview";
import { OmAssetsMobileList, OmAssetsTable } from "@/components/enterprise/OmAssetsTable";
import { OmMaintenanceScheduleSlideOver } from "@/components/enterprise/OmMaintenanceScheduleSlideOver";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_COMPACT_INPUT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { MOBILE_FIELD_INPUT } from "@/lib/mobileFormStyles";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

type Props = { projectId: string };

function formatAssetLocation(a: OmAssetRow): string {
  const parts = [a.hall, a.rowLabel, a.rack, a.positionU].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(" / ");
  return a.locationLabel?.trim() || "—";
}

const exportLinkClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]";

// fallow-ignore-next-line complexity
export function OmAssetsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;

  const [showAdd, setShowAdd] = useState(false);
  const [createDraft, setCreateDraft] = useState<AssetFormDraft>(() => emptyAssetDraft());
  const [createPendingImage, setCreatePendingImage] = useState<File | null>(null);
  const [createDrawingSearch, setCreateDrawingSearch] = useState("");
  const [justCreatedAsset, setJustCreatedAsset] = useState<OmAssetRow | null>(null);
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false);
  const [maintenanceAssetId, setMaintenanceAssetId] = useState<string | null>(null);
  const [maintenanceFormSession, setMaintenanceFormSession] = useState(0);

  const [editingAsset, setEditingAsset] = useState<OmAssetRow | null>(null);
  const [editDraft, setEditDraft] = useState<AssetFormDraft>(() => emptyAssetDraft());
  const [editPendingImage, setEditPendingImage] = useState<File | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [editDrawingSearch, setEditDrawingSearch] = useState("");
  const [detailAsset, setDetailAsset] = useState<OmAssetRow | null>(null);

  const [listSearchInput, setListSearchInput] = useState("");
  const [debouncedListQ, setDebouncedListQ] = useState("");
  const [listFilter, setListFilter] = useState<OmAssetsListFilter>("ALL");
  const nowMs = useTickNowMs();
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedListQ(listSearchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [listSearchInput]);

  const [linkAsset, setLinkAsset] = useState<OmAssetRow | null>(null);
  const [linkDrawingSearch, setLinkDrawingSearch] = useState("");
  const [linkExpandedFileId, setLinkExpandedFileId] = useState<string | null>(null);
  const [linkPickVersionId, setLinkPickVersionId] = useState<Record<string, string>>({});

  const {
    data: rows = [],
    isPending,
    error,
  } = useQuery({
    queryKey: qk.omAssets(projectId, debouncedListQ),
    queryFn: () => fetchOmAssets(projectId, { q: debouncedListQ || undefined }),
  });

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
    staleTime: 30_000,
  });

  const needProjectFiles = Boolean(wid && (showAdd || editingAsset || linkAsset || detailAsset));
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: needProjectFiles,
  });
  const project = projects.find((p) => p.id === projectId);
  const pdfFiles = useMemo(() => {
    if (!project) return [];
    return project.files.filter((f) => isPdfFile(f)).sort((a, b) => a.name.localeCompare(b.name));
  }, [project]);

  const filteredLinkPdfs = useMemo(() => {
    const q = linkDrawingSearch.trim().toLowerCase();
    if (!q) return pdfFiles;
    return pdfFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [pdfFiles, linkDrawingSearch]);

  useEffect(() => {
    if (!editingAsset) return;
    setEditDraft(assetDraftFromRow(editingAsset));
    setEditPendingImage(null);
    setEditRemoveImage(false);
  }, [editingAsset]);

  const detailLive = useMemo(() => {
    if (!detailAsset) return null;
    return rows.find((r) => r.id === detailAsset.id) ?? detailAsset;
  }, [rows, detailAsset]);

  const invalidateAssets = () => qc.invalidateQueries({ queryKey: ["om", "assets", projectId] });

  const closeAddSlide = useCallback(() => {
    setShowAdd(false);
    setCreateDraft(emptyAssetDraft());
    setCreatePendingImage(null);
    setCreateDrawingSearch("");
    setJustCreatedAsset(null);
  }, []);

  const openMaintenanceForAsset = useCallback((assetId: string) => {
    setMaintenanceAssetId(assetId);
    setMaintenanceFormSession((n) => n + 1);
    setShowCreateMaintenance(true);
  }, []);

  const closeEditSlide = useCallback(() => setEditingAsset(null), []);

  const closeLinkSlide = useCallback(() => {
    setLinkAsset(null);
    setLinkDrawingSearch("");
    setLinkExpandedFileId(null);
  }, []);

  const createMut = useMutation({
    mutationFn: async () => {
      const row = await createOmAsset(projectId, assetDraftToCreateBody(createDraft));
      if (createPendingImage) {
        return uploadOmAssetImageFile(projectId, row.id, createPendingImage);
      }
      return row;
    },
    onSuccess: async (row) => {
      if (createPendingImage) {
        qc.removeQueries({ queryKey: qk.omAssetImageReadUrl(projectId, row.id) });
      }
      await invalidateAssets();
      setCreatePendingImage(null);
      setJustCreatedAsset(row);
      toast.success(
        createPendingImage
          ? "Asset saved with photo. Add documents below if you need to, then click Done."
          : "Asset saved. Add documents below if you need to, then click Done.",
      );
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editingAsset) throw new Error("No asset");
      let row = await patchOmAsset(projectId, editingAsset.id, assetDraftToPatchBody(editDraft));
      if (editRemoveImage && editingAsset.hasImage) {
        row = await deleteOmAssetImage(projectId, editingAsset.id);
      }
      if (editPendingImage) {
        row = await uploadOmAssetImageFile(projectId, editingAsset.id, editPendingImage);
      }
      return row;
    },
    onSuccess: async (_, __, _ctx) => {
      if (editingAsset) {
        qc.removeQueries({ queryKey: qk.omAssetImageReadUrl(projectId, editingAsset.id) });
      }
      setEditPendingImage(null);
      setEditRemoveImage(false);
      await invalidateAssets();
      setEditingAsset(null);
      toast.success("Asset updated.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOmAsset(projectId, id),
    onSuccess: async (_, id) => {
      await invalidateAssets();
      setEditingAsset(null);
      setDetailAsset((d) => (d?.id === id ? null : d));
      toast.success("Asset deleted.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const clearLinkMut = useMutation({
    mutationFn: async (assetId: string) => {
      return patchOmAsset(projectId, assetId, {
        fileId: null,
        fileVersionId: null,
        pageNumber: null,
        annotationId: null,
        pinJson: null,
        bimAnchor: null,
      });
    },
    onSuccess: async () => {
      await invalidateAssets();
      toast.success("Model / drawing link cleared.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const attachRevisionMut = useMutation({
    mutationFn: async (vars: { asset: OmAssetRow; fileId: string; fileVersionId: string }) => {
      return patchOmAsset(projectId, vars.asset.id, {
        fileId: vars.fileId,
        fileVersionId: vars.fileVersionId,
        pageNumber: null,
        annotationId: null,
        pinJson: null,
        // Keep bimAnchor so a linked PDF does not drop the 3D element.
      });
    },
    onSuccess: async () => {
      await invalidateAssets();
      setLinkAsset(null);
      setLinkDrawingSearch("");
      setLinkExpandedFileId(null);
      toast.success("Drawing revision attached.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  function openViewerForAsset(
    f: CloudFile,
    asset: OmAssetRow,
    preferredVersionId?: string,
    mode: "place" | "focus" = "place",
  ) {
    const sorted = sortedVersions(f);
    const verRow =
      (preferredVersionId ? sorted.find((v) => v.id === preferredVersionId) : undefined) ??
      sorted[0];
    if (!verRow) {
      toast.error("No revision available for this drawing.");
      return;
    }
    const resolvedMode = mode === "focus" ? "focus" : omAssetViewerMode(asset);
    const q = buildOmAssetViewerQuery(projectId, f, asset, verRow, resolvedMode);
    router.push(`/viewer?${q.toString()}`);
    setLinkAsset(null);
    setLinkDrawingSearch("");
    setLinkExpandedFileId(null);
  }

  function openDrawingForLinkedAsset(asset: OmAssetRow) {
    if (!project) return;
    const f = omAssetLinkedPdfFile(asset, project.files);
    if (!f) {
      toast.error("No PDF drawing linked to this asset.");
      return;
    }
    const sorted = sortedVersions(f);
    const verRow = sorted.find((v) => v.id === asset.fileVersionId) ?? sorted[0];
    if (!verRow) {
      toast.error("No revision available for this drawing.");
      return;
    }
    openViewerForAsset(f, asset, verRow.id, assetHasSheetPin(asset) ? "focus" : "place");
  }

  function openBimForLinkedAsset(asset: OmAssetRow) {
    const href = omAssetBimViewerHref(projectId, asset, project?.files ?? []);
    if (!href) {
      toast.error("Could not open 3D model for this asset.");
      return;
    }
    openBimViewer(href);
  }

  function startPlacePinForAsset(asset: OmAssetRow) {
    if (!project) return;
    if (asset.fileId) {
      const f = project.files.find((x) => x.id === asset.fileId);
      if (f) {
        closeAddSlide();
        openViewerForAsset(f, asset, asset.fileVersionId ?? undefined, "place");
        return;
      }
    }
    setLinkAsset(asset);
    setJustCreatedAsset(null);
    setShowAdd(false);
    setCreateDraft(emptyAssetDraft());
    setCreatePendingImage(null);
    setCreateDrawingSearch("");
  }

  function versionIdForLinkFile(f: CloudFile): string {
    const existing = linkPickVersionId[f.id];
    const sorted = sortedVersions(f);
    if (existing && sorted.some((v) => v.id === existing)) return existing;
    return sorted[0]?.id ?? "";
  }

  const filteredRows = useMemo(
    () => filterOmAssets(rows, listFilter, nowMs),
    [rows, listFilter, nowMs],
  );

  const canExportRegisterCsv =
    Boolean(projectSession?.operationsMode) &&
    Boolean(projectSession?.settings.modules.omAssets) &&
    (projectSession?.workspaceRole === "SUPER_ADMIN" || projectSession?.workspaceRole === "ADMIN");

  const canExportQrCsv =
    canExportRegisterCsv && Boolean(projectSession?.settings.modules.omTenantPortal);

  function handleEditAsset(a: OmAssetRow) {
    setEditingAsset(a);
    setEditDrawingSearch("");
  }

  function handleLinkAsset(a: OmAssetRow) {
    setLinkAsset(a);
    setLinkDrawingSearch("");
    setLinkExpandedFileId(null);
  }

  function handleClearLink(id: string) {
    if (confirm("Clear the model / drawing link for this asset?")) {
      clearLinkMut.mutate(id);
    }
  }

  if (ctxLoading || isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EnterpriseLoadingState message="Loading assets…" label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-[var(--enterprise-semantic-danger-text)]">
        {error instanceof Error ? error.message : "Could not load assets."}
      </p>
    );
  }

  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${OM_PAGE_CLASS}`}>
      <OmSubPageHeader
        icon={Package}
        title="Assets"
        description="Equipment register — photos, documents, and drawing pins."
        action={
          <>
            {canExportRegisterCsv ? (
              <a href={omAssetRegisterCsvUrl(projectId)} className={exportLinkClass}>
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Asset CSV
              </a>
            ) : null}
            {canExportQrCsv ? (
              <a href={omOccupantAssetQrCsvUrl(projectId)} className={exportLinkClass}>
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                QR CSV
              </a>
            ) : null}
            <EnterpriseButton
              size="sm"
              onClick={() => {
                setJustCreatedAsset(null);
                setCreateDraft(emptyAssetDraft());
                setCreatePendingImage(null);
                setCreateDrawingSearch("");
                setShowAdd(true);
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Add asset
            </EnterpriseButton>
          </>
        }
      />

      {rows.length > 0 ? (
        <OmAssetsOverview
          rows={rows}
          filter={listFilter}
          onFilterChange={setListFilter}
          searchActive={Boolean(debouncedListQ)}
        />
      ) : null}

      <section className="enterprise-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[var(--enterprise-border)] px-3 py-2.5 sm:px-4">
          <div className="relative min-w-0">
            <label className="sr-only" htmlFor="asset-list-search">
              Search assets
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="asset-list-search"
              value={listSearchInput}
              onChange={(e) => setListSearchInput(e.target.value)}
              placeholder="Search tag, name, location…"
              className={`${OM_COMPACT_INPUT} enterprise-field-input--icon-sm`}
            />
          </div>
          {rows.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              {filteredRows.length === 1 ? "1 asset" : `${filteredRows.length} assets`}
              {debouncedListQ ? " matching search" : ""}
              {listFilter !== "ALL" ? " · filtered" : ""} · Click a row for details
            </p>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
              aria-hidden
            >
              <Package className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-base font-semibold text-[var(--enterprise-text)]">
                {debouncedListQ ? "No matching assets" : "No assets yet"}
              </p>
              <p className="text-sm text-[var(--enterprise-text-muted)]">
                {debouncedListQ
                  ? "Try a different search term or clear the filter."
                  : "Add equipment with a tag, name, and optional photo."}
              </p>
            </div>
            {!debouncedListQ ? (
              <EnterpriseButton
                size="sm"
                onClick={() => {
                  setJustCreatedAsset(null);
                  setCreateDraft(emptyAssetDraft());
                  setCreatePendingImage(null);
                  setShowAdd(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add first asset
              </EnterpriseButton>
            ) : null}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <p className="text-base font-semibold text-[var(--enterprise-text)]">
              No assets match this filter
            </p>
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Clear the overview filter or adjust search.
            </p>
            <EnterpriseButton size="sm" variant="secondary" onClick={() => setListFilter("ALL")}>
              Clear filter
            </EnterpriseButton>
          </div>
        ) : (
          <div className="enterprise-scrollbar min-h-0 flex-1 overflow-auto">
            <div className="hidden md:block">
              <OmAssetsTable
                projectId={projectId}
                projectFiles={project?.files ?? []}
                rows={filteredRows}
                formatLocation={formatAssetLocation}
                onOpenDetail={setDetailAsset}
                onEdit={handleEditAsset}
                onLink={handleLinkAsset}
                onViewDrawing={openDrawingForLinkedAsset}
                onViewBim={openBimForLinkedAsset}
                onClearLink={handleClearLink}
                clearLinkPending={clearLinkMut.isPending}
              />
            </div>
            <div className="md:hidden">
              <OmAssetsMobileList
                projectId={projectId}
                projectFiles={project?.files ?? []}
                rows={filteredRows}
                formatLocation={formatAssetLocation}
                onOpenDetail={setDetailAsset}
                onEdit={handleEditAsset}
                onLink={handleLinkAsset}
                onViewDrawing={openDrawingForLinkedAsset}
                onViewBim={openBimForLinkedAsset}
                onClearLink={handleClearLink}
                clearLinkPending={clearLinkMut.isPending}
              />
            </div>
          </div>
        )}
      </section>

      <EnterpriseSlideOver
        open={showAdd}
        onClose={closeAddSlide}
        ariaLabelledBy="create-asset-title"
        closeOnBackdrop={false}
        closeOnEscape={false}
        overlayZClass="z-[100]"
        header={
          <SlideOverHeader
            icon={Package}
            titleId="create-asset-title"
            title={justCreatedAsset ? "Attach documents" : "New asset"}
            description={
              justCreatedAsset ? (
                <>
                  <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                    {justCreatedAsset.tag}
                  </span>
                  {" — "}
                  {justCreatedAsset.name}. Optional files, then Done.
                </>
              ) : (
                "Add equipment details, optionally link a drawing, then save to upload documents."
              )
            }
          />
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {justCreatedAsset ? (
              <>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => startPlacePinForAsset(justCreatedAsset)}
                >
                  <Package
                    className="h-3.5 w-3.5 text-[var(--enterprise-primary)]"
                    strokeWidth={2}
                  />
                  Place on drawing
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setJustCreatedAsset(null);
                    setCreateDraft(emptyAssetDraft());
                    setCreatePendingImage(null);
                    setCreateDrawingSearch("");
                  }}
                >
                  Add another asset
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const assetId = justCreatedAsset.id;
                    closeAddSlide();
                    openMaintenanceForAsset(assetId);
                  }}
                >
                  Create maintenance schedule
                </EnterpriseButton>
                <EnterpriseButton size="sm" onClick={closeAddSlide}>
                  Done
                </EnterpriseButton>
              </>
            ) : (
              <>
                <EnterpriseButton variant="secondary" size="sm" onClick={closeAddSlide}>
                  Cancel
                </EnterpriseButton>
                <EnterpriseButton
                  size="sm"
                  disabled={
                    !createDraft.tag.trim() || !createDraft.name.trim() || createMut.isPending
                  }
                  loading={createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  Save
                </EnterpriseButton>
              </>
            )}
          </div>
        }
      >
        {justCreatedAsset ? (
          <div className="space-y-4">
            <div className="enterprise-alert-success rounded-2xl p-4">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">Asset saved</p>
              <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                <span className="font-mono font-semibold text-[var(--enterprise-primary)]">
                  {justCreatedAsset.tag}
                </span>{" "}
                — {justCreatedAsset.name}. Add documents below if needed.
              </p>
            </div>
            <OmAssetDocumentsBlock projectId={projectId} assetId={justCreatedAsset.id} enabled />
          </div>
        ) : (
          <OmAssetFormFields
            draft={createDraft}
            onChange={setCreateDraft}
            formKey="create"
            projectId={projectId}
            pdfFiles={pdfFiles}
            drawingSearch={createDrawingSearch}
            onDrawingSearchChange={setCreateDrawingSearch}
            imageField={{
              pendingFile: createPendingImage,
              onPendingFileChange: setCreatePendingImage,
              disabled: createMut.isPending,
            }}
          />
        )}
      </EnterpriseSlideOver>

      <EnterpriseSlideOver
        open={Boolean(editingAsset)}
        onClose={closeEditSlide}
        ariaLabelledBy="edit-asset-title"
        closeOnBackdrop={false}
        closeOnEscape={false}
        overlayZClass="z-[100]"
        header={
          <SlideOverHeader
            icon={Package}
            titleId="edit-asset-title"
            title="Edit asset"
            description={editingAsset ? editingAsset.tag : undefined}
          />
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {editingAsset ? (
              <EnterpriseButton
                variant="danger"
                size="sm"
                disabled={deleteMut.isPending}
                loading={deleteMut.isPending}
                onClick={() => {
                  if (
                    !confirm(
                      `Delete asset ${editingAsset.tag}? This cannot be undone. Maintenance rows for this asset may block deletion — remove them first if needed.`,
                    )
                  )
                    return;
                  deleteMut.mutate(editingAsset.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </EnterpriseButton>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <EnterpriseButton variant="secondary" size="sm" onClick={closeEditSlide}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                size="sm"
                disabled={!editDraft.tag.trim() || !editDraft.name.trim() || updateMut.isPending}
                loading={updateMut.isPending}
                onClick={() => updateMut.mutate()}
              >
                Save changes
              </EnterpriseButton>
            </div>
          </div>
        }
      >
        {editingAsset ? (
          <div className="space-y-6">
            <OmAssetFormFields
              draft={editDraft}
              onChange={setEditDraft}
              formKey="edit"
              projectId={projectId}
              pdfFiles={pdfFiles}
              drawingSearch={editDrawingSearch}
              onDrawingSearchChange={setEditDrawingSearch}
              levelName={editingAsset.levelName}
              imageField={{
                assetId: editingAsset.id,
                hasExistingImage: editingAsset.hasImage,
                pendingFile: editPendingImage,
                onPendingFileChange: setEditPendingImage,
                removeExisting: editRemoveImage,
                onRemoveExistingChange: setEditRemoveImage,
                disabled: updateMut.isPending,
              }}
            />
            <div className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/30 p-4">
              <OmAssetDocumentsBlock projectId={projectId} assetId={editingAsset.id} enabled />
            </div>
          </div>
        ) : null}
      </EnterpriseSlideOver>

      <EnterpriseSlideOver
        open={Boolean(linkAsset)}
        onClose={closeLinkSlide}
        ariaLabelledBy="link-asset-title"
        closeOnBackdrop={false}
        closeOnEscape={false}
        overlayZClass="z-[100]"
        header={
          <SlideOverHeader
            icon={Package}
            titleId="link-asset-title"
            title="Link to drawing"
            description={
              linkAsset ? (
                <>
                  Attach a PDF revision or place a pin for{" "}
                  <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                    {linkAsset.tag}
                  </span>
                  .
                </>
              ) : undefined
            }
          />
        }
        footer={
          <p className="w-full text-center text-xs text-[var(--enterprise-text-muted)] sm:text-left">
            Expand a file to pick a revision, then attach or open the viewer.
          </p>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              strokeWidth={2}
            />
            <input
              value={linkDrawingSearch}
              onChange={(e) => setLinkDrawingSearch(e.target.value)}
              placeholder="Search documents…"
              className={`${MOBILE_FIELD_INPUT} enterprise-field-input--icon`}
            />
          </div>
          {!wid || !project ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">Loading files…</p>
          ) : filteredLinkPdfs.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              No matching PDFs in this project. Add PDFs to the project elsewhere if you need to
              link a drawing.
            </p>
          ) : (
            <ul className="space-y-2 pb-2">
              {filteredLinkPdfs.map((f) => {
                const expanded = linkExpandedFileId === f.id;
                const sorted = sortedVersions(f);
                const vid = versionIdForLinkFile(f);
                return (
                  <li
                    key={f.id}
                    className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
                  >
                    <button
                      type="button"
                      onClick={() => setLinkExpandedFileId(expanded ? null : f.id)}
                      className="flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--enterprise-text)]"
                    >
                      <span className="min-w-0 truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-[var(--enterprise-text-muted)]">
                        {expanded ? "▲" : "▼"}
                      </span>
                    </button>
                    {expanded ? (
                      <div className="space-y-2 border-t border-[var(--enterprise-border)] px-3 py-3">
                        <label className="block text-xs">
                          <span className="mb-1 block text-[var(--enterprise-text-muted)]">
                            Revision
                          </span>
                          <select
                            value={vid}
                            onChange={(e) =>
                              setLinkPickVersionId((m) => ({ ...m, [f.id]: e.target.value }))
                            }
                            className="min-h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm text-[var(--enterprise-text)]"
                          >
                            {sorted.map((v: FileVersion) => (
                              <option key={v.id} value={v.id}>
                                v{v.version}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={attachRevisionMut.isPending || !vid || !linkAsset}
                            onClick={() =>
                              linkAsset &&
                              attachRevisionMut.mutate({
                                asset: linkAsset,
                                fileId: f.id,
                                fileVersionId: vid,
                              })
                            }
                            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)] hover:bg-[var(--enterprise-surface)] disabled:opacity-50"
                          >
                            Attach revision
                          </button>
                          <button
                            type="button"
                            disabled={!linkAsset}
                            onClick={() =>
                              linkAsset && openViewerForAsset(f, linkAsset, versionIdForLinkFile(f))
                            }
                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                          >
                            <Package className="h-3.5 w-3.5" strokeWidth={2} />
                            Place equipment pin
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </EnterpriseSlideOver>

      <OmAssetDetailSlide
        open={Boolean(detailAsset)}
        onClose={() => setDetailAsset(null)}
        projectId={projectId}
        asset={detailLive}
        projectFiles={project?.files ?? []}
        onEdit={() => {
          if (!detailLive) return;
          setDetailAsset(null);
          setEditingAsset(detailLive);
          setEditDrawingSearch("");
        }}
        onDelete={(a) => {
          if (
            !confirm(
              `Delete asset ${a.tag}? This cannot be undone. Maintenance rows for this asset may block deletion — remove them first if needed.`,
            )
          )
            return;
          deleteMut.mutate(a.id);
        }}
      />

      <OmMaintenanceScheduleSlideOver
        projectId={projectId}
        open={showCreateMaintenance}
        schedule={null}
        formSession={maintenanceFormSession}
        initialAssetId={maintenanceAssetId}
        onClose={() => setShowCreateMaintenance(false)}
      />
    </div>
  );
}

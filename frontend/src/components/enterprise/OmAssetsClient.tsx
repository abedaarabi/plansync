"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Link2,
  MapPin,
  Package,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createOmAsset,
  deleteOmAsset,
  fetchOmAssets,
  fetchProjects,
  patchOmAsset,
  type OmAssetRow,
  ProRequiredError,
} from "@/lib/api-client";
import { sortedVersions } from "@/components/file-explorer/fileExplorerUtils";
import { isPdfFile } from "@/lib/isPdfFile";
import { qk } from "@/lib/queryKeys";
import type { CloudFile, FileVersion } from "@/types/projects";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetDetailSlide } from "@/components/enterprise/OmAssetDetailSlide";
import { OmAssetDocumentsBlock } from "@/components/enterprise/OmAssetDocumentsBlock";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

type Props = { projectId: string };

type AssetFormDraft = {
  tag: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  locationLabel: string;
  installDate: string;
  warrantyExpires: string;
  lastServiceAt: string;
  notes: string;
  attachFileId: string;
  attachFileVersionId: string;
};

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

function dateInputToIsoNullable(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return `${t}T12:00:00.000Z`;
}

function emptyDraft(): AssetFormDraft {
  return {
    tag: "",
    name: "",
    category: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    locationLabel: "",
    installDate: "",
    warrantyExpires: "",
    lastServiceAt: "",
    notes: "",
    attachFileId: "",
    attachFileVersionId: "",
  };
}

function draftFromAsset(a: OmAssetRow): AssetFormDraft {
  return {
    tag: a.tag,
    name: a.name,
    category: a.category ?? "",
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    serialNumber: a.serialNumber ?? "",
    locationLabel: a.locationLabel ?? "",
    installDate: isoToDateInput(a.installDate),
    warrantyExpires: isoToDateInput(a.warrantyExpires),
    lastServiceAt: isoToDateInput(a.lastServiceAt),
    notes: a.notes ?? "",
    attachFileId: a.fileId ?? "",
    attachFileVersionId: a.fileVersionId ?? "",
  };
}

function draftToCreateBody(d: AssetFormDraft): Parameters<typeof createOmAsset>[1] {
  const hasFile = d.attachFileId.trim().length > 0 && d.attachFileVersionId.trim().length > 0;
  return {
    tag: d.tag.trim(),
    name: d.name.trim(),
    category: d.category.trim() || null,
    manufacturer: d.manufacturer.trim() || null,
    model: d.model.trim() || null,
    serialNumber: d.serialNumber.trim() || null,
    locationLabel: d.locationLabel.trim() || null,
    installDate: dateInputToIsoNullable(d.installDate),
    warrantyExpires: dateInputToIsoNullable(d.warrantyExpires),
    lastServiceAt: dateInputToIsoNullable(d.lastServiceAt),
    notes: d.notes.trim() || null,
    ...(hasFile
      ? {
          fileId: d.attachFileId.trim(),
          fileVersionId: d.attachFileVersionId.trim(),
          pageNumber: null,
          annotationId: null,
        }
      : {}),
  };
}

function AssetFormFields({
  draft,
  onChange,
  formKey,
  projectId,
  pdfFiles,
  drawingSearch,
  onDrawingSearchChange,
}: {
  draft: AssetFormDraft;
  onChange: (next: AssetFormDraft) => void;
  formKey: string;
  projectId: string;
  pdfFiles: CloudFile[];
  drawingSearch: string;
  onDrawingSearchChange: (q: string) => void;
}) {
  const filteredPdfs = useMemo(() => {
    const q = drawingSearch.trim().toLowerCase();
    if (!q) return pdfFiles;
    return pdfFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [pdfFiles, drawingSearch]);

  const selectedFile = pdfFiles.find((f) => f.id === draft.attachFileId);
  const versions = selectedFile ? sortedVersions(selectedFile) : [];

  const field =
    "min-h-11 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)]";
  const label = "mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <span className={label}>Tag (e.g. AHU-01)</span>
        <input
          id={`asset-form-${formKey}-tag`}
          value={draft.tag}
          onChange={(e) => onChange({ ...draft, tag: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Name</span>
        <input
          id={`asset-form-${formKey}-name`}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className={label}>Category</span>
        <input
          id={`asset-form-${formKey}-category`}
          value={draft.category}
          onChange={(e) => onChange({ ...draft, category: e.target.value })}
          className={field}
          placeholder="e.g. HVAC"
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Manufacturer</span>
        <input
          value={draft.manufacturer}
          onChange={(e) => onChange({ ...draft, manufacturer: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Model</span>
        <input
          value={draft.model}
          onChange={(e) => onChange({ ...draft, model: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Serial number</span>
        <input
          value={draft.serialNumber}
          onChange={(e) => onChange({ ...draft, serialNumber: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Location label</span>
        <input
          value={draft.locationLabel}
          onChange={(e) => onChange({ ...draft, locationLabel: e.target.value })}
          className={field}
          placeholder="e.g. Roof · East plant room"
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Install date</span>
        <input
          type="date"
          value={draft.installDate}
          onChange={(e) => onChange({ ...draft, installDate: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Warranty expires</span>
        <input
          type="date"
          value={draft.warrantyExpires}
          onChange={(e) => onChange({ ...draft, warrantyExpires: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className={label}>Last service</span>
        <input
          type="date"
          value={draft.lastServiceAt}
          onChange={(e) => onChange({ ...draft, lastServiceAt: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className={label}>Notes</span>
        <textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          rows={3}
          className={`${field} min-h-[5rem] resize-y`}
          placeholder="Specs, supplier contacts, access instructions…"
        />
      </label>

      <div className="sm:col-span-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Linked drawing (optional)
        </p>
        <p className="mb-3 text-xs text-[var(--enterprise-text-muted)]">
          Pick a PDF and revision to attach without a sheet pin, or leave empty and use{" "}
          <strong className="text-[var(--enterprise-text)]">Link on sheet</strong> after saving.
        </p>
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
            strokeWidth={2}
          />
          <input
            value={drawingSearch}
            onChange={(e) => onDrawingSearchChange(e.target.value)}
            placeholder="Search project PDFs…"
            className={`${field} pl-10`}
            aria-label="Search drawings"
          />
        </div>
        {pdfFiles.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            No PDF drawings are listed for this project yet. When PDFs exist on the project, you can
            attach one here.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className={label}>Document</span>
              <select
                value={draft.attachFileId}
                onChange={(e) => {
                  const fid = e.target.value;
                  const f = pdfFiles.find((x) => x.id === fid);
                  const v0 = f ? sortedVersions(f)[0] : undefined;
                  onChange({
                    ...draft,
                    attachFileId: fid,
                    attachFileVersionId: v0?.id ?? "",
                  });
                }}
                className={field}
              >
                <option value="">— None —</option>
                {filteredPdfs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedFile ? (
              <label className="block text-sm sm:col-span-2">
                <span className={label}>Revision</span>
                <select
                  value={draft.attachFileVersionId}
                  onChange={(e) => onChange({ ...draft, attachFileVersionId: e.target.value })}
                  className={field}
                >
                  {versions.map((v: FileVersion) => (
                    <option key={v.id} value={v.id}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function OmAssetsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;

  const [showAdd, setShowAdd] = useState(false);
  const [createDraft, setCreateDraft] = useState<AssetFormDraft>(() => emptyDraft());
  const [createDrawingSearch, setCreateDrawingSearch] = useState("");
  const [justCreatedAsset, setJustCreatedAsset] = useState<OmAssetRow | null>(null);

  const [editingAsset, setEditingAsset] = useState<OmAssetRow | null>(null);
  const [editDraft, setEditDraft] = useState<AssetFormDraft>(() => emptyDraft());
  const [editDrawingSearch, setEditDrawingSearch] = useState("");
  const [detailAsset, setDetailAsset] = useState<OmAssetRow | null>(null);

  const [listSearchInput, setListSearchInput] = useState("");
  const [debouncedListQ, setDebouncedListQ] = useState("");
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
    setEditDraft(draftFromAsset(editingAsset));
  }, [editingAsset]);

  const detailLive = useMemo(() => {
    if (!detailAsset) return null;
    return rows.find((r) => r.id === detailAsset.id) ?? detailAsset;
  }, [rows, detailAsset]);

  const invalidateAssets = () => qc.invalidateQueries({ queryKey: ["om", "assets", projectId] });

  const closeAddSlide = useCallback(() => {
    setShowAdd(false);
    setCreateDraft(emptyDraft());
    setCreateDrawingSearch("");
    setJustCreatedAsset(null);
  }, []);

  const closeEditSlide = useCallback(() => setEditingAsset(null), []);

  const closeLinkSlide = useCallback(() => {
    setLinkAsset(null);
    setLinkDrawingSearch("");
    setLinkExpandedFileId(null);
  }, []);

  const createMut = useMutation({
    mutationFn: () => createOmAsset(projectId, draftToCreateBody(createDraft)),
    onSuccess: async (row) => {
      await invalidateAssets();
      setJustCreatedAsset(row);
      toast.success("Asset saved. Add documents below if you need to, then click Done.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editingAsset) throw new Error("No asset");
      const d = editDraft;
      const hasFile = d.attachFileId.trim().length > 0 && d.attachFileVersionId.trim().length > 0;
      return patchOmAsset(projectId, editingAsset.id, {
        tag: d.tag.trim(),
        name: d.name.trim(),
        category: d.category.trim() || null,
        manufacturer: d.manufacturer.trim() || null,
        model: d.model.trim() || null,
        serialNumber: d.serialNumber.trim() || null,
        locationLabel: d.locationLabel.trim() || null,
        installDate: dateInputToIsoNullable(d.installDate),
        warrantyExpires: dateInputToIsoNullable(d.warrantyExpires),
        lastServiceAt: dateInputToIsoNullable(d.lastServiceAt),
        notes: d.notes.trim() || null,
        ...(hasFile
          ? {
              fileId: d.attachFileId.trim(),
              fileVersionId: d.attachFileVersionId.trim(),
            }
          : {
              fileId: null,
              fileVersionId: null,
              pageNumber: null,
              annotationId: null,
              pinJson: null,
            }),
      });
    },
    onSuccess: async () => {
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
      });
    },
    onSuccess: async () => {
      await invalidateAssets();
      toast.success("Drawing link cleared.");
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

  function openViewerForAsset(f: CloudFile, asset: OmAssetRow, preferredVersionId?: string) {
    const sorted = sortedVersions(f);
    const verRow =
      (preferredVersionId ? sorted.find((v) => v.id === preferredVersionId) : undefined) ??
      sorted[0];
    const q = new URLSearchParams({
      fileId: f.id,
      name: f.name,
      projectId,
      omAssetLink: "1",
      omAssetId: asset.id,
      omAssetTag: encodeURIComponent(asset.tag),
      omAssetName: encodeURIComponent(asset.name),
    });
    if (verRow) {
      q.set("version", String(verRow.version));
      q.set("fileVersionId", verRow.id);
    }
    router.push(`/viewer?${q.toString()}`);
    setLinkAsset(null);
    setLinkDrawingSearch("");
    setLinkExpandedFileId(null);
  }

  function openViewerForLinkedAsset(asset: OmAssetRow) {
    if (!asset.fileId || !project) return;
    const f = project.files.find((x) => x.id === asset.fileId);
    if (!f) return;
    const sorted = sortedVersions(f);
    const verRow = sorted.find((v) => v.id === asset.fileVersionId) ?? sorted[0];
    const q = new URLSearchParams({
      fileId: f.id,
      name: f.name,
      projectId,
      omAssetLink: "1",
      omAssetId: asset.id,
      omAssetTag: encodeURIComponent(asset.tag),
      omAssetName: encodeURIComponent(asset.name),
    });
    if (verRow) {
      q.set("version", String(verRow.version));
      q.set("fileVersionId", verRow.id);
    }
    router.push(`/viewer?${q.toString()}`);
  }

  function versionIdForLinkFile(f: CloudFile): string {
    const existing = linkPickVersionId[f.id];
    const sorted = sortedVersions(f);
    if (existing && sorted.some((v) => v.id === existing)) return existing;
    return sorted[0]?.id ?? "";
  }

  if (ctxLoading || isPending) {
    return <EnterpriseLoadingState message="Loading assets…" label="Loading" />;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load assets."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
            aria-hidden
          >
            <Package className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Assets
            </h1>
            <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">
              Search and maintain the register. Upload manuals, certificates, and other files for a
              specific asset when you create it (after save) or when you edit it. Optionally link a
              project PDF drawing below or use Link on a row for viewer pins.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => {
              setJustCreatedAsset(null);
              setShowAdd(true);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-stretch rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-xs)] transition hover:opacity-95 sm:min-h-10 sm:self-start"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add asset
          </button>
        </div>
      </header>

      <div className="enterprise-card p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Search assets
          </span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              strokeWidth={2}
            />
            <input
              value={listSearchInput}
              onChange={(e) => setListSearchInput(e.target.value)}
              placeholder="Tag, name, category, manufacturer, serial, location, notes, drawing name…"
              className="min-h-11 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-2 pl-10 pr-3 text-sm text-[var(--enterprise-text)]"
            />
          </div>
        </label>
      </div>

      <EnterpriseSlideOver
        open={showAdd}
        onClose={closeAddSlide}
        ariaLabelledBy="create-asset-title"
        panelMaxWidthClass="max-w-2xl"
        overlayZClass="z-[100]"
        header={
          <div>
            <h2
              id="create-asset-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              {justCreatedAsset ? "Attach documents" : "New asset"}
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              {justCreatedAsset ? (
                <>
                  <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                    {justCreatedAsset.tag}
                  </span>
                  <span className="text-[var(--enterprise-text-muted)]"> — </span>
                  {justCreatedAsset.name}. Add files for this asset (any type, optional), then Done.
                </>
              ) : (
                <>
                  Add equipment details and optionally link a drawing revision, then save to upload
                  documents.
                </>
              )}
            </p>
          </div>
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {justCreatedAsset ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setJustCreatedAsset(null);
                    setCreateDraft(emptyDraft());
                    setCreateDrawingSearch("");
                  }}
                  className="inline-flex min-h-11 items-center rounded-lg border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
                >
                  Add another asset
                </button>
                <button
                  type="button"
                  onClick={closeAddSlide}
                  className="inline-flex min-h-11 items-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={closeAddSlide}
                  className="inline-flex min-h-11 items-center rounded-lg border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    !createDraft.tag.trim() || !createDraft.name.trim() || createMut.isPending
                  }
                  onClick={() => createMut.mutate()}
                  className="inline-flex min-h-11 items-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save
                </button>
              </>
            )}
          </div>
        }
      >
        {justCreatedAsset ? (
          <OmAssetDocumentsBlock projectId={projectId} assetId={justCreatedAsset.id} enabled />
        ) : (
          <AssetFormFields
            draft={createDraft}
            onChange={setCreateDraft}
            formKey="create"
            projectId={projectId}
            pdfFiles={pdfFiles}
            drawingSearch={createDrawingSearch}
            onDrawingSearchChange={setCreateDrawingSearch}
          />
        )}
      </EnterpriseSlideOver>

      <EnterpriseSlideOver
        open={Boolean(editingAsset)}
        onClose={closeEditSlide}
        ariaLabelledBy="edit-asset-title"
        panelMaxWidthClass="max-w-2xl"
        overlayZClass="z-[100]"
        header={
          <div>
            <h2
              id="edit-asset-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Edit asset
            </h2>
            {editingAsset ? (
              <p className="mt-1 font-mono text-sm text-[var(--enterprise-text-muted)]">
                {editingAsset.tag}
              </p>
            ) : null}
          </div>
        }
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {editingAsset ? (
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (
                    !confirm(
                      `Delete asset ${editingAsset.tag}? This cannot be undone. Maintenance rows for this asset may block deletion — remove them first if needed.`,
                    )
                  )
                    return;
                  deleteMut.mutate(editingAsset.id);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/40 sm:justify-start"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEditSlide}
                className="inline-flex min-h-11 items-center rounded-lg border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editDraft.tag.trim() || !editDraft.name.trim() || updateMut.isPending}
                onClick={() => updateMut.mutate()}
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        }
      >
        {editingAsset ? (
          <div className="space-y-8">
            <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-4">
              <OmAssetDocumentsBlock projectId={projectId} assetId={editingAsset.id} enabled />
            </div>
            <AssetFormFields
              draft={editDraft}
              onChange={setEditDraft}
              formKey="edit"
              projectId={projectId}
              pdfFiles={pdfFiles}
              drawingSearch={editDrawingSearch}
              onDrawingSearchChange={setEditDrawingSearch}
            />
          </div>
        ) : null}
      </EnterpriseSlideOver>

      <EnterpriseSlideOver
        open={Boolean(linkAsset)}
        onClose={closeLinkSlide}
        ariaLabelledBy="link-asset-title"
        panelMaxWidthClass="max-w-lg"
        overlayZClass="z-[100]"
        header={
          <div>
            <h2
              id="link-asset-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Link to drawing
            </h2>
            {linkAsset ? (
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Search PDFs, attach a revision without a pin, or open the viewer to place the pin
                for{" "}
                <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                  {linkAsset.tag}
                </span>
                .
              </p>
            ) : null}
          </div>
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
              className="min-h-11 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-2 pl-10 pr-3 text-sm text-[var(--enterprise-text)]"
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
                            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                            Open viewer · place pin
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
        pdfFiles={pdfFiles}
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

      {rows.length === 0 ? (
        <div className="enterprise-card px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)]">
          {debouncedListQ
            ? "No assets match your search."
            : "No assets yet. Add equipment with full details, then link a drawing."}
        </div>
      ) : (
        <div className="enterprise-card overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--enterprise-border)] text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                <th className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-4 py-3">
                  Tag
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Drawing</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-[var(--enterprise-border)]/80">
                  <td className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-4 py-3 font-mono text-xs font-semibold text-[var(--enterprise-text)]">
                    {a.tag}
                  </td>
                  <td className="px-4 py-3 text-[var(--enterprise-text)]">{a.name}</td>
                  <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">
                    {a.manufacturer ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">
                    {a.locationLabel ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">
                    {a.file ? `${a.file.name} v${a.fileVersion?.version ?? "?"}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailAsset(a)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-bg)]"
                      >
                        <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={2} />
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAsset(a);
                          setEditDrawingSearch("");
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-bg)]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        Edit
                      </button>
                      {a.fileId ? (
                        <button
                          type="button"
                          onClick={() => openViewerForLinkedAsset(a)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-bg)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                          View
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setLinkAsset(a);
                          setLinkDrawingSearch("");
                          setLinkExpandedFileId(null);
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-bg)]"
                      >
                        <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Link
                      </button>
                      {a.fileId ? (
                        <button
                          type="button"
                          disabled={clearLinkMut.isPending}
                          onClick={() => {
                            if (confirm("Clear the drawing link for this asset?")) {
                              clearLinkMut.mutate(a.id);
                            }
                          }}
                          className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

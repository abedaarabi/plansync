"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";
import {
  completeOmAssetDocumentUpload,
  deleteOmAssetDocument,
  fetchOmAssetDocumentReadUrl,
  fetchOmAssetDocuments,
  presignOmAssetDocumentUpload,
  type OmAssetDocumentRow,
  type OmAssetRow,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { BimGlassDock } from "./BimGlassDock";

const MAX_ASSET_DOC_BYTES = 25 * 1024 * 1024;

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <div>
      <dt className="text-[10px] font-medium text-[var(--bim-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-[12px] font-medium text-[var(--bim-text)]">{v}</dd>
    </div>
  );
}

function DocumentsSection(props: { projectId: string; assetId: string }) {
  const { projectId, assetId } = props;
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const { data: documents = [], isPending } = useQuery({
    queryKey: qk.omAssetDocuments(projectId, assetId),
    queryFn: () => fetchOmAssetDocuments(projectId, assetId),
    enabled: Boolean(projectId && assetId),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: string) => deleteOmAssetDocument(projectId, assetId, docId),
    onSuccess: async (_, docId) => {
      await qc.invalidateQueries({ queryKey: qk.omAssetDocuments(projectId, assetId) });
      qc.removeQueries({ queryKey: qk.omAssetDocumentReadUrl(projectId, assetId, docId) });
      toast.success("Document removed.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro required." : e.message);
    },
  });

  async function onPickFile(file: File) {
    if (file.size > MAX_ASSET_DOC_BYTES) {
      toast.error("File too large (max 25 MB).");
      return;
    }
    setUploadBusy(true);
    const contentType = file.type || "application/octet-stream";
    try {
      const { uploadUrl, key } = await presignOmAssetDocumentUpload(projectId, assetId, {
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      await completeOmAssetDocumentUpload(projectId, assetId, {
        key,
        fileName: file.name,
        mimeType: contentType,
        sizeBytes: file.size,
      });
      await qc.invalidateQueries({ queryKey: qk.omAssetDocuments(projectId, assetId) });
      toast.success("Document uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function openDoc(doc: OmAssetDocumentRow) {
    try {
      const url = await fetchOmAssetDocumentReadUrl(projectId, assetId, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document.");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
          Documents
        </p>
        <button
          type="button"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          className="bim-focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--bim-accent)] hover:bg-[color-mix(in_srgb,var(--bim-panel)_70%,transparent)] disabled:opacity-40"
        >
          {uploadBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickFile(f);
          }}
        />
      </div>

      {isPending ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">
          No documents yet. Upload manuals or certificates.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)] px-2 py-1.5"
            >
              <FileText
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]"
                strokeWidth={2}
              />
              <button
                type="button"
                onClick={() => void openDoc(doc)}
                className="min-w-0 flex-1 break-words text-left text-[12px] font-medium leading-snug text-[var(--bim-accent)] hover:underline"
              >
                {doc.label?.trim() || doc.fileName}
              </button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm("Remove this document?")) deleteMut.mutate(doc.id);
                }}
                className="mt-0.5 shrink-0 rounded p-1 text-[var(--bim-text-muted)] hover:bg-[color-mix(in_srgb,var(--bim-panel)_70%,transparent)] hover:text-red-400"
                aria-label="Delete document"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BimAssetInfoPanel(props: {
  asset: OmAssetRow;
  projectId: string;
  modelName: string;
  onClose: () => void;
}) {
  const { asset, projectId } = props;
  const level = asset.bimAnchor?.spatialPath?.[0]?.trim() || asset.locationLabel?.trim() || null;
  const guid = asset.bimAnchor?.ifcGuid?.trim() || null;

  return (
    <BimGlassDock
      side="right"
      open
      title={asset.tag}
      subtitle={asset.name}
      onClose={props.onClose}
      closeOnOutsideClick={false}
    >
      <div className="space-y-3 px-3 py-2.5">
        {asset.hasImage ? (
          <div className="overflow-hidden rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)]">
            <OmAssetImageThumb
              projectId={projectId}
              assetId={asset.id}
              hasImage={asset.hasImage}
              alt={asset.name}
              className="max-h-36 w-full object-cover object-center"
              fallbackClassName="flex h-24 w-full items-center justify-center bg-[color-mix(in_srgb,var(--bim-panel)_50%,transparent)]"
            />
          </div>
        ) : null}

        <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
            Location & model
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <InfoRow label="Level" value={level} />
            <InfoRow label="Category" value={asset.category} />
            <InfoRow label="Model file" value={asset.file?.name ?? props.modelName} />
            <InfoRow label="Type" value={asset.bimAnchor?.ifcType ?? asset.category} />
          </dl>
        </section>

        <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
            Equipment
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <InfoRow label="Manufacturer" value={asset.manufacturer} />
            <InfoRow label="Model" value={asset.model} />
            <InfoRow label="Serial" value={asset.serialNumber} />
          </dl>
        </section>

        <DocumentsSection projectId={projectId} assetId={asset.id} />

        {guid ? (
          <section className="space-y-1.5 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_25%,transparent)] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              Linked element
            </p>
            <p className="break-all font-mono text-[10px] text-[var(--bim-text)]">{guid}</p>
          </section>
        ) : null}

        {asset.notes?.trim() ? (
          <section className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--bim-text)]">
              {asset.notes}
            </p>
          </section>
        ) : null}
      </div>
    </BimGlassDock>
  );
}

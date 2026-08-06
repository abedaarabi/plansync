"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { fetchOmAssetDocumentReadUrl, type OmAssetDocumentRow } from "@/lib/api-client";
import { useOmAssetDocuments } from "@/lib/useOmAssetDocuments";
import { OmAssetDocumentThumbnail } from "@/components/enterprise/OmAssetDocumentThumbnail";

type Props = {
  projectId: string;
  assetId: string;
  enabled?: boolean;
};

export function OmAssetDocumentsBlock({ projectId, assetId, enabled = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const {
    documents,
    isPending: docsPending,
    uploadBusy,
    deleteMut,
    uploadDocument,
  } = useOmAssetDocuments({ projectId, assetId, enabled });

  async function onPickFile(file: File) {
    const ok = await uploadDocument(file, { label: uploadLabel.trim() || undefined });
    if (ok) setUploadLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function downloadDoc(doc: OmAssetDocumentRow) {
    try {
      const url = await fetchOmAssetDocumentReadUrl(projectId, assetId, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document.");
    }
  }

  if (!assetId) return null;

  return (
    <section>
      <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        Documents
      </h3>
      <p className="mb-3 text-[13px] text-[var(--enterprise-text-muted)]">
        Any file type, up to 25 MB each (PDF, images, Office, archives, etc.).
      </p>
      <div className="mb-3 space-y-3">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-[var(--enterprise-text-muted)]">
            Label (optional)
          </span>
          <input
            value={uploadLabel}
            onChange={(e) => setUploadLabel(e.target.value)}
            placeholder="e.g. Manufacturer manual"
            disabled={uploadBusy}
            className="min-h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
          />
        </label>
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
        <button
          type="button"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-xs)] hover:opacity-95 disabled:opacity-50"
        >
          {uploadBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={2} />
          )}
          Upload document
        </button>
      </div>
      {docsPending ? (
        <p className="text-[13px] text-[var(--enterprise-text-muted)]">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-[13px] text-[var(--enterprise-text-muted)]">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-stretch justify-between gap-3 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-2"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
                <OmAssetDocumentThumbnail
                  projectId={projectId}
                  assetId={assetId}
                  documentId={doc.id}
                  mimeType={doc.mimeType}
                  fileName={doc.fileName}
                  className="h-full w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => void downloadDoc(doc)}
                className="flex min-w-0 flex-1 flex-col items-stretch justify-center gap-0.5 text-left text-[13px] font-medium text-[var(--enterprise-primary)] hover:underline"
              >
                <span className="line-clamp-2">{doc.label?.trim() || doc.fileName}</span>
                {doc.label?.trim() && doc.label.trim() !== doc.fileName ? (
                  <span className="line-clamp-1 text-[11px] font-normal text-[var(--enterprise-text-muted)]">
                    {doc.fileName}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm("Remove this document?")) deleteMut.mutate(doc.id);
                }}
                className="shrink-0 self-center rounded p-1.5 text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)]"
                aria-label="Delete document"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

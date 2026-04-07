"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  completeOmAssetDocumentUpload,
  deleteOmAssetDocument,
  fetchOmAssetDocumentReadUrl,
  fetchOmAssetDocuments,
  presignOmAssetDocumentUpload,
  type OmAssetDocumentRow,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { OmAssetDocumentThumbnail } from "@/components/enterprise/OmAssetDocumentThumbnail";

const MAX_ASSET_DOC_BYTES = 25 * 1024 * 1024;

function guessContentType(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  return "application/octet-stream";
}

type Props = {
  projectId: string;
  assetId: string;
  enabled?: boolean;
};

export function OmAssetDocumentsBlock({ projectId, assetId, enabled = true }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const { data: documents = [], isPending: docsPending } = useQuery({
    queryKey: qk.omAssetDocuments(projectId, assetId),
    queryFn: () => fetchOmAssetDocuments(projectId, assetId),
    enabled: enabled && Boolean(assetId),
  });

  const deleteDocMut = useMutation({
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
    const contentType = guessContentType(file);
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
      if (!put.ok) {
        const hint = await put.text().catch(() => "");
        throw new Error(
          hint.trim()
            ? `Upload failed (${put.status}). ${hint.slice(0, 200)}`
            : `Upload failed (${put.status}).`,
        );
      }
      await completeOmAssetDocumentUpload(projectId, assetId, {
        key,
        label: uploadLabel.trim() || undefined,
        fileName: file.name,
        mimeType: contentType,
        sizeBytes: file.size,
      });
      setUploadLabel("");
      await qc.invalidateQueries({ queryKey: qk.omAssetDocuments(projectId, assetId) });
      toast.success("Document uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                onClick={() => downloadDoc(doc)}
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
                disabled={deleteDocMut.isPending}
                onClick={() => {
                  if (confirm("Remove this document?")) deleteDocMut.mutate(doc.id);
                }}
                className="shrink-0 self-center rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
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

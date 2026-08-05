"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { fetchOmAssetDocumentReadUrl, type OmAssetDocumentRow } from "@/lib/api-client";
import { useOmAssetDocuments } from "@/lib/useOmAssetDocuments";

export function BimAssetDocumentsSection(props: { projectId: string; assetId: string }) {
  const { projectId, assetId } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, isPending, uploadBusy, deleteMut, uploadDocument } = useOmAssetDocuments({
    projectId,
    assetId,
  });

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
            if (f) {
              void uploadDocument(f).finally(() => {
                if (fileInputRef.current) fileInputRef.current.value = "";
              });
            }
          }}
        />
      </div>

      <p className="text-[10px] text-[var(--bim-text-muted)]">
        Any file type up to 25 MB (manuals, certificates, PDFs, etc.).
      </p>

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

"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import {
  fetchOmAssetDocumentReadUrl,
  fetchOmAssetDocuments,
  type OmAssetDocumentRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  assetId: string;
  enabled?: boolean;
};

export function WorkOrderAssetDocsPanel({ projectId, assetId, enabled = true }: Props) {
  const { data: documents = [], isPending } = useQuery({
    queryKey: qk.omAssetDocuments(projectId, assetId),
    queryFn: () => fetchOmAssetDocuments(projectId, assetId),
    enabled: enabled && Boolean(assetId),
  });

  if (!assetId) return null;

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--enterprise-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading manuals…
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-[var(--enterprise-text-muted)]">
        No manuals or documents on this asset yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <DocRow key={doc.id} projectId={projectId} assetId={assetId} doc={doc} />
      ))}
    </ul>
  );
}

function DocRow({
  projectId,
  assetId,
  doc,
}: {
  projectId: string;
  assetId: string;
  doc: OmAssetDocumentRow;
}) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.omAssetDocumentReadUrl(projectId, assetId, doc.id),
    queryFn: () => fetchOmAssetDocumentReadUrl(projectId, assetId, doc.id),
    staleTime: 4 * 60_000,
  });

  const label = doc.label.trim() || doc.fileName;

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--enterprise-text)]">
        <FileText className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
        >
          Open
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--enterprise-text-muted)]" />
      ) : null}
    </li>
  );
}

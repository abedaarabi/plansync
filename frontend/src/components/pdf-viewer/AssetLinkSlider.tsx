"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileStack, Hash, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { patchOmAsset, ProRequiredError } from "@/lib/api-client";
import { normRectFromAnnotationPoints } from "@/lib/issueFocus";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

type Props = { onClose: () => void };

export function AssetLinkSlider({ onClose }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const omAssetCreateDraft = useViewerStore((s) => s.omAssetCreateDraft);
  const updateAnnotation = useViewerStore((s) => s.updateAnnotation);
  const removeAnnotation = useViewerStore((s) => s.removeAnnotation);
  const removeAnnotations = useViewerStore((s) => s.removeAnnotations);
  const annotations = useViewerStore((s) => s.annotations);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const fileName = useViewerStore((s) => s.fileName);
  const setOmAssetCreateDraft = useViewerStore((s) => s.setOmAssetCreateDraft);

  const fileId = searchParams.get("fileId");
  const projectId = searchParams.get("projectId")?.trim() || viewerProjectId;
  const omAssetId = searchParams.get("omAssetId")?.trim();

  const annotationId = omAssetCreateDraft?.annotationId;
  const ann = annotations.find((a) => a.id === annotationId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!annotationId || !ann) {
      setOmAssetCreateDraft(null);
    }
  }, [annotationId, ann, setOmAssetCreateDraft]);

  const pinJson = useMemo(() => {
    if (!ann?.points) return null;
    return {
      normRect: normRectFromAnnotationPoints(ann.points),
      pageIndex: ann.pageIndex,
    };
  }, [ann]);

  const stripLinkParamsFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("omAssetLink");
    params.delete("omAssetId");
    params.delete("omAssetTag");
    params.delete("omAssetName");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !omAssetId || !fileId || !cloudFileVersionId || !annotationId || !ann) {
        throw new Error("Missing sheet or asset context. Open a project PDF from Files.");
      }
      const pageNumber = ann.pageIndex + 1;
      const dupIds = annotations
        .filter((a) => a.linkedOmAssetId === omAssetId && a.id !== annotationId)
        .map((a) => a.id);
      if (dupIds.length) removeAnnotations(dupIds);

      return patchOmAsset(projectId, omAssetId, {
        fileId,
        fileVersionId: cloudFileVersionId,
        pageNumber,
        annotationId,
        pinJson: pinJson ?? undefined,
      });
    },
    onSuccess: (row) => {
      if (annotationId) {
        updateAnnotation(annotationId, {
          omAssetDraft: false,
          linkedOmAssetId: omAssetId ?? undefined,
          linkedOmAssetTag: row.tag,
          linkedOmAssetName: row.name,
        });
      }
      void qc.invalidateQueries({ queryKey: ["om", "assets", projectId!] });
      setOmAssetCreateDraft(null);
      toast.success("Asset linked to this sheet.");
      stripLinkParamsFromUrl();
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const onCancel = useCallback(() => {
    if (saveMut.isPending) return;
    if (annotationId) removeAnnotation(annotationId);
    setOmAssetCreateDraft(null);
    stripLinkParamsFromUrl();
    onClose();
  }, [
    annotationId,
    onClose,
    removeAnnotation,
    saveMut.isPending,
    setOmAssetCreateDraft,
    stripLinkParamsFromUrl,
  ]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mounted, onCancel]);

  if (!mounted || typeof document === "undefined" || !omAssetCreateDraft || !ann) return null;

  const tag = ann.linkedOmAssetTag?.trim() || "Equipment";
  const assetTitle = ann.linkedOmAssetName?.trim() || tag;
  const pageLabel = ann.pageIndex + 1;
  const versionLabel = searchParams.get("version") ? `v${searchParams.get("version")}` : "—";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[120] overflow-x-hidden overscroll-x-none"
        role="presentation"
      >
        <button
          type="button"
          aria-label="Close asset link"
          className="absolute inset-0 bg-white/55 transition hover:bg-white/65"
          onClick={onCancel}
          onMouseDown={(e) => e.preventDefault()}
        />
        <aside
          role="dialog"
          aria-modal
          aria-labelledby="asset-link-title"
          className="absolute right-0 top-0 flex h-full w-full min-w-0 max-w-[min(420px,calc(100dvw-1rem))] flex-col overflow-x-hidden border-l border-slate-200 bg-white shadow-none"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0 space-y-0.5 pr-1">
              <h2
                id="asset-link-title"
                className="text-sm font-semibold tracking-tight text-slate-900"
              >
                Link asset to sheet
              </h2>
              <p className="text-[11px] leading-snug text-slate-500">
                Pin equipment so the register opens the right drawing and location.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={saveMut.isPending}
              className="viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </header>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none px-5 py-4 [scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]">
            <div
              className="mb-4 flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 ring-1 ring-slate-900/5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-1"
              role="group"
              aria-label="Sheet context"
            >
              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                <FileStack
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--viewer-icon)] sm:mt-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="min-w-0 text-[11px] font-medium leading-snug text-slate-700 [overflow-wrap:anywhere]">
                  {fileName?.trim() || "Sheet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-500">
                  Rev {versionLabel}
                </span>
                <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-500">
                  <Hash
                    className="h-2.5 w-2.5 text-[var(--viewer-icon)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  Page {pageLabel}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[var(--viewer-primary)]/25 bg-[var(--viewer-primary)]/10 px-3 py-3">
              <Link2
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--viewer-primary)]"
                strokeWidth={2}
                aria-hidden
              />
              <div>
                <p className="text-[13px] font-semibold leading-snug text-[var(--viewer-text)]">
                  {assetTitle}
                </p>
                {ann.linkedOmAssetName?.trim() && tag !== ann.linkedOmAssetName.trim() ? (
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--viewer-text-muted)]">
                    {tag}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  The pin on the sheet will stay with this PDF revision. You can move the pin with
                  the Select tool before saving.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saveMut.isPending || !cloudFileVersionId}
                onClick={() => saveMut.mutate()}
                className="inline-flex min-h-10 min-w-[7rem] items-center justify-center rounded-lg bg-[var(--viewer-primary)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveMut.isPending ? "Saving…" : "Save link"}
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={onCancel}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
            {!cloudFileVersionId ? (
              <p className="mt-3 text-[11px] text-amber-700">
                Pro cloud revision is required to save the link. Open this PDF from the project
                Files list (not a local file).
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </>,
    document.body,
  );
}

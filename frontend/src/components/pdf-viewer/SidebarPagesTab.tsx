"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { setupPdfWorker } from "@/lib/pdf";
import { pdfUnitsToMm } from "@/lib/pagePaperInfo";
import { useViewerStore } from "@/store/viewerStore";

const THUMB_MAX_CSS_PX = 140;

type ThumbProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onSelect: () => void;
  sizeLabel: string;
  markupCount: number;
};

function PageThumbnailCard({
  doc,
  pageNumber,
  isActive,
  onSelect,
  sizeLabel,
  markupCount,
}: ThumbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShouldRender(true);
      },
      { root: null, rootMargin: "160px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldRender || rendered) return;
    let cancelled = false;
    let task: { cancel?: () => void } | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = THUMB_MAX_CSS_PX / base.width;
        const vp = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const renderTask = page.render({
          canvasContext: ctx,
          viewport: vp,
          canvas,
        });
        task = renderTask;
        await renderTask.promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setRendered(true);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel?.();
    };
  }, [doc, pageNumber, shouldRender, rendered]);

  return (
    <div ref={wrapRef} className="w-full">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? "page" : undefined}
        title={`Open page ${pageNumber}${sizeLabel ? ` — ${sizeLabel}` : ""}${markupCount > 0 ? ` — ${markupCount} markup${markupCount === 1 ? "" : "s"}` : ""}`}
        className={`flex w-full flex-col items-center rounded-lg border p-1 text-center transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${
          isActive
            ? "border-blue-500/70 bg-blue-600/15 ring-1 ring-blue-500/40"
            : "border-slate-700/90 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/80"
        }`}
      >
        <div
          className="relative mx-auto flex min-h-18 w-full items-center justify-center overflow-hidden rounded border border-slate-800 bg-white"
          style={{ maxWidth: THUMB_MAX_CSS_PX }}
        >
          {!rendered && (
            <span className="absolute inset-0 animate-pulse bg-slate-200/90 dark:bg-slate-700/50" />
          )}
          <canvas
            ref={canvasRef}
            className={`relative z-1 mx-auto block h-auto max-w-full ${rendered ? "opacity-100" : "opacity-0"}`}
            width={0}
            height={0}
          />
        </div>
        <div className="mt-1 w-full px-0.5">
          <p className="text-[10px] font-semibold tabular-nums text-slate-200">Page {pageNumber}</p>
          <p className="truncate text-[8px] text-slate-500" title={sizeLabel}>
            {sizeLabel}
          </p>
          {markupCount > 0 && (
            <p className="text-[8px] text-amber-400/90">
              {markupCount} markup{markupCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

export function SidebarPagesTab() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const numPages = useViewerStore((s) => s.numPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const annotations = useViewerStore((s) => s.annotations);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeWrapRef = useRef<HTMLDivElement | null>(null);

  const markupsByPage = useMemo(() => {
    const m: Record<number, number> = {};
    for (const a of annotations) {
      m[a.pageIndex] = (m[a.pageIndex] ?? 0) + 1;
    }
    return m;
  }, [annotations]);

  const pageNumbers = useMemo(
    () => (numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []),
    [numPages],
  );

  useEffect(() => {
    if (!pdfUrl) {
      setDoc(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setDoc(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const d = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (!cancelled) setDoc(d);
      } catch {
        if (!cancelled) setLoadError("Could not load page previews.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    activeWrapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  if (!pdfUrl) {
    return (
      <p className="px-1 text-center text-[10px] leading-relaxed text-slate-500">
        Open a PDF to see page thumbnails.
      </p>
    );
  }

  if (numPages < 1) {
    return <p className="px-1 text-center text-[10px] text-slate-500">Loading page count…</p>;
  }

  if (loadError) {
    return <p className="px-1 text-center text-[10px] text-red-400">{loadError}</p>;
  }

  if (!doc) {
    return <p className="px-1 text-center text-[10px] text-slate-500">Loading previews…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <p className="mb-1.5 shrink-0 px-0.5 text-[9px] leading-snug text-slate-500">
        Tap a thumbnail to open that page.
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-0.5 pb-2 [scrollbar-width:thin]">
        {pageNumbers.map((pg) => {
          const idx = pg - 1;
          const sz = pageSizePtByPage[idx];
          const sizeStr = sz
            ? `${Math.round(pdfUnitsToMm(sz.wPt))}×${Math.round(pdfUnitsToMm(sz.hPt))} mm`
            : "Size after visit";
          const mc = markupsByPage[idx] ?? 0;
          const isActive = pg === currentPage;
          return (
            <div key={pg} ref={isActive ? activeWrapRef : undefined}>
              <PageThumbnailCard
                doc={doc}
                pageNumber={pg}
                isActive={isActive}
                onSelect={() => setCurrentPage(pg)}
                sizeLabel={sizeStr}
                markupCount={mc}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

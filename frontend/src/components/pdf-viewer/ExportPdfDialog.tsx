"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  exportPdfWithMarkups,
  resolveExportPageNumbers,
  type PageListMode,
} from "@/lib/exportPdfWithMarkups";
import { useViewerStore } from "@/store/viewerStore";

type Props = {
  pdfDoc: PDFDocumentProxy | null;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

function useClickOutside(
  popRef: React.RefObject<HTMLElement | null>,
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, popRef, anchorRef]);
}

export function ExportPdfDialog({ pdfDoc, open, onClose, anchorRef }: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const annotations = useViewerStore((s) => s.annotations);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const numPages = useViewerStore((s) => s.numPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const fileName = useViewerStore((s) => s.fileName);

  const [mode, setMode] = useState<PageListMode>("all");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useClickOutside(popRef, anchorRef, open, onClose);

  useEffect(() => {
    if (!open) {
      setError(null);
      setProgress(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const runExport = async () => {
    if (!pdfDoc || numPages < 1) return;
    setError(null);
    const resolved = resolveExportPageNumbers(mode, numPages, currentPage, custom.trim());
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: resolved.pages.length });
    try {
      await exportPdfWithMarkups({
        pdfDoc,
        annotations,
        measureUnit,
        pageNumbers: resolved.pages,
        fileNameBase: fileName ?? "sheet",
        onProgress: (p) => setProgress(p),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div
      ref={popRef}
      className="absolute right-0 top-full z-[90] mt-1 w-[min(calc(100vw-1rem),300px)] rounded-xl border border-[#334155] bg-[#1E293B] p-3 shadow-2xl ring-1 ring-black/25"
      role="dialog"
      aria-label="Export PDF with markups"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-400/85">
        Export PDF with markups
      </p>
      <p className="mb-2 text-[10px] leading-snug text-slate-500">
        Each page is rasterized with your markups burned in. Large documents may take a moment.
      </p>

      <fieldset className="mb-2 space-y-1.5 border-0 p-0">
        <legend className="sr-only">Pages to include</legend>
        <label
          className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300"
          title="Include every page in the exported PDF"
        >
          <input
            type="radio"
            name="exp-pages"
            checked={mode === "all"}
            onChange={() => setMode("all")}
            className="border-slate-600"
          />
          All pages ({numPages})
        </label>
        <label
          className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300"
          title="Export only the page you are viewing"
        >
          <input
            type="radio"
            name="exp-pages"
            checked={mode === "current"}
            onChange={() => setMode("current")}
            className="border-slate-600"
          />
          Current page only ({currentPage})
        </label>
        <label
          className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300"
          title="Pick specific pages or ranges below"
        >
          <input
            type="radio"
            name="exp-pages"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
            className="border-slate-600"
          />
          Custom
        </label>
      </fieldset>

      {mode === "custom" && (
        <label className="mb-2 block text-[11px] text-slate-500">
          Page numbers
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. 1, 3, 5-8"
            disabled={busy}
            title="Comma-separated pages or ranges, e.g. 1,3,5-8"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-600"
          />
        </label>
      )}

      {error && <p className="mb-2 text-[11px] text-red-400">{error}</p>}

      {busy && progress && (
        <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />
          Page {progress.done} / {progress.total}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !pdfDoc || numPages < 1}
        onClick={() => void runExport()}
        title="Save a new PDF with markups burned in for the pages you chose"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-blue-500 to-indigo-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:from-blue-400 hover:to-indigo-400 disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting…
          </>
        ) : (
          "Download PDF"
        )}
      </button>
    </div>
  );
}

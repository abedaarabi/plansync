"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ClipboardList,
  FileDown,
  FileJson,
  Image as ImageIcon,
  Loader2,
  Package,
  Printer,
  Table,
  X,
} from "lucide-react";
import { fetchIssuesForFileVersion, fetchMe } from "@/lib/api-client";
import {
  DEFAULT_SHEET_EXPORT_INCLUDE,
  filterAnnotationsForExport,
  loadSheetExportInclude,
  saveSheetExportInclude,
  type SheetExportInclude,
} from "@/lib/exportIncludeFilter";
import { buildIssuesCsv, downloadIssuesCsv } from "@/lib/exportIssuesCsv";
import { openIssuesPrintReport } from "@/lib/exportIssuesReport";
import { buildMeasuresCsv, downloadMeasuresCsv } from "@/lib/exportMeasuresCsv";
import {
  exportPdfWithMarkups,
  resolveExportPageNumbers,
  type PageListMode,
} from "@/lib/exportPdfWithMarkups";
import { downloadCanvasPng, downloadMarkupJson } from "@/lib/exportSheet";
import { buildTakeoffCsv, downloadTakeoffCsv } from "@/lib/exportTakeoffCsv";
import { openTakeoffPrintReport } from "@/lib/exportTakeoffReport";
import { meHasProWorkspace, viewerHasProSheetFeatures } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfDoc: PDFDocumentProxy | null;
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>;
};

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border border-slate-700/80 bg-slate-900/40 px-2 py-1.5 text-[11px] text-slate-200 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-600"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function SheetExportDialog({ open, onClose, pdfDoc, exportCanvasRef }: Props) {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const annotations = useViewerStore((s) => s.annotations);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);

  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  const showTakeoff = viewerHasProSheetFeatures(me ?? null, cloudFileVersionId);

  const { data: sheetIssues = [], isPending: sheetIssuesPending } = useQuery({
    queryKey: qk.issuesForFileVersion(cloudFileVersionId ?? ""),
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!),
    enabled: Boolean(cloudFileVersionId) && meHasProWorkspace(me ?? null),
    staleTime: 30_000,
  });

  const [include, setInclude] = useState<SheetExportInclude>(DEFAULT_SHEET_EXPORT_INCLUDE);
  const [pdfMode, setPdfMode] = useState<PageListMode>("all");
  const [pdfCustom, setPdfCustom] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInclude(loadSheetExportInclude());
    setPdfError(null);
    setPdfProgress(null);
    setPdfBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    saveSheetExportInclude(include);
  }, [include, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setPreset = useCallback((kind: "all" | "markups" | "none") => {
    if (kind === "all") {
      setInclude({
        markups: true,
        measurements: true,
        issuePins: true,
        takeoff: true,
      });
    } else if (kind === "markups") {
      setInclude({
        markups: true,
        measurements: false,
        issuePins: false,
        takeoff: false,
      });
    } else {
      setInclude({
        markups: false,
        measurements: false,
        issuePins: false,
        takeoff: false,
      });
    }
  }, []);

  const filteredAnnotations = filterAnnotationsForExport(annotations, include);

  const runExportPdf = async () => {
    if (!pdfDoc || numPages < 1) return;
    setPdfError(null);
    const resolved = resolveExportPageNumbers(pdfMode, numPages, currentPage, pdfCustom.trim());
    if (!resolved.ok) {
      setPdfError(resolved.error);
      return;
    }
    setPdfBusy(true);
    setPdfProgress({ done: 0, total: resolved.pages.length });
    try {
      await exportPdfWithMarkups({
        pdfDoc,
        annotations: filteredAnnotations,
        measureUnit,
        pageNumbers: resolved.pages,
        fileNameBase: fileName ?? "sheet",
        onProgress: setPdfProgress,
        takeoffItems,
        takeoffZones,
        includeTakeoff: include.takeoff && showTakeoff,
      });
      onClose();
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setPdfBusy(false);
      setPdfProgress(null);
    }
  };

  const runExportPng = async () => {
    const canvas = exportCanvasRef?.current ?? null;
    const idx = currentPage - 1;
    const sz = pageSizePtByPage[idx];
    const pageAnnotations = filteredAnnotations.filter((a) => a.pageIndex === idx);
    await downloadCanvasPng(
      canvas,
      fileName ?? "sheet",
      pageAnnotations.length > 0 && (sz?.wPt ?? 0) > 0 && (sz?.hPt ?? 0) > 0
        ? {
            pageAnnotations,
            pageW: sz!.wPt,
            pageH: sz!.hPt,
            measureUnit,
          }
        : null,
      include.takeoff && showTakeoff
        ? {
            takeoffItems,
            takeoffZones,
            pageIndex0: idx,
            includeTakeoff: true,
          }
        : null,
    );
    onClose();
  };

  const base = (fileName ?? "sheet").replace(/\.pdf$/i, "");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#334155] bg-[#1E293B] shadow-2xl ring-1 ring-black/25"
        role="dialog"
        aria-labelledby="sheet-export-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#334155] px-4 py-3">
          <h2 id="sheet-export-title" className="text-sm font-semibold text-slate-100">
            Export & print
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
            Choose what to burn into <strong className="font-medium text-slate-300">PDF</strong> and{" "}
            <strong className="font-medium text-slate-300">PNG</strong> exports. Presets and
            checkboxes are saved in this browser (localStorage).
          </p>
          <ul className="mb-3 list-inside list-disc space-y-1 text-[10px] leading-relaxed text-slate-500">
            <li>
              <strong className="font-medium text-slate-400">Menu:</strong>{" "}
              <strong className="text-slate-400">Document info</strong> and{" "}
              <strong className="text-slate-400">Shortcuts</strong> are in the top bar menu (lines
              icon), not here.
            </li>
            <li>
              <strong className="font-medium text-slate-400">Tip:</strong> use{" "}
              <strong className="text-slate-400">Download PDF</strong> for a clean, shareable sheet;
              browser print keeps the full viewer chrome unless you use print preview settings.
            </li>
            <li>
              Export <strong className="text-slate-400">JSON</strong> before big edits or
              experiments — it is your full markup backup for this file.
            </li>
            <li>
              CSV / issue / takeoff reports always list{" "}
              <strong className="text-slate-400">all</strong> rows for the sheet (not filtered by
              the checkboxes).
            </li>
          </ul>

          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPreset("all")}
              className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
            >
              All on
            </button>
            <button
              type="button"
              onClick={() => setPreset("markups")}
              className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
            >
              Markups only
            </button>
            <button
              type="button"
              onClick={() => setPreset("none")}
              className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
            >
              Clear all
            </button>
          </div>

          <fieldset className="mb-4 space-y-1.5 border-0 p-0">
            <legend className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Include on PDF / PNG
            </legend>
            <ToggleRow
              id="inc-markups"
              label="Markups"
              hint="Pen, highlighter, shapes, text, clouds"
              checked={include.markups}
              onChange={(v) => setInclude((s) => ({ ...s, markups: v }))}
            />
            <ToggleRow
              id="inc-measures"
              label="Measurements"
              hint="Calibrated dimensions, areas, angles on the sheet"
              checked={include.measurements}
              onChange={(v) => setInclude((s) => ({ ...s, measurements: v }))}
            />
            <ToggleRow
              id="inc-issues"
              label="Issue pins"
              hint="Colored pins linked to the Issues tab"
              checked={include.issuePins}
              onChange={(v) => setInclude((s) => ({ ...s, issuePins: v }))}
            />
            <ToggleRow
              id="inc-takeoff"
              label="Takeoff zones"
              hint="Quantity areas, lines, and counts (Pro)"
              checked={include.takeoff}
              onChange={(v) => setInclude((s) => ({ ...s, takeoff: v }))}
              disabled={!showTakeoff}
            />
          </fieldset>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Export PDF
          </p>
          <fieldset className="mb-2 space-y-1.5 border-0 p-0">
            <legend className="sr-only">Pages</legend>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="radio"
                name="exp-pages"
                checked={pdfMode === "all"}
                onChange={() => setPdfMode("all")}
                disabled={pdfBusy}
              />
              All pages ({numPages})
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="radio"
                name="exp-pages"
                checked={pdfMode === "current"}
                onChange={() => setPdfMode("current")}
                disabled={pdfBusy}
              />
              Current page ({currentPage})
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="radio"
                name="exp-pages"
                checked={pdfMode === "custom"}
                onChange={() => setPdfMode("custom")}
                disabled={pdfBusy}
              />
              Custom
            </label>
          </fieldset>
          {pdfMode === "custom" && (
            <input
              type="text"
              value={pdfCustom}
              onChange={(e) => setPdfCustom(e.target.value)}
              placeholder="e.g. 1, 3, 5-8"
              disabled={pdfBusy}
              className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-600"
            />
          )}
          {pdfError ? <p className="mb-2 text-[11px] text-red-400">{pdfError}</p> : null}
          {pdfBusy && pdfProgress ? (
            <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              Page {pdfProgress.done} / {pdfProgress.total}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!pdfUrl || !pdfDoc || numPages < 1 || pdfBusy}
            onClick={() => void runExportPdf()}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-blue-500 to-indigo-500 px-3 py-2 text-xs font-medium text-white shadow-sm hover:from-blue-400 hover:to-indigo-400 disabled:opacity-40"
          >
            {pdfBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5" />
                Download PDF
              </>
            )}
          </button>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Current page image
          </p>
          <button
            type="button"
            disabled={!pdfUrl}
            onClick={() => void runExportPng()}
            className="mb-4 flex w-full items-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Export PNG (this page)
          </button>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Data & reports
          </p>
          <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
            CSV / JSON below are full sheet data (not filtered by the checkboxes). JSON is a
            complete markup backup for restore or support.
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={!pdfUrl}
              onClick={() => {
                downloadMarkupJson(fileName ?? "sheet", annotations, calibrationByPage);
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <FileJson className="h-3.5 w-3.5 text-slate-400" />
              Export JSON (full backup)
            </button>
            <button
              type="button"
              disabled={!pdfUrl}
              onClick={() => {
                const csv = buildMeasuresCsv(
                  annotations.filter((a) => a.type === "measurement"),
                  measureUnit,
                  null,
                );
                downloadMeasuresCsv(`${base}-measures.csv`, csv);
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <Table className="h-3.5 w-3.5 text-slate-400" />
              Export measures CSV (all)
            </button>
            <button
              type="button"
              disabled={!pdfUrl || !showTakeoff || takeoffItems.length === 0}
              onClick={() => {
                const csv = buildTakeoffCsv(takeoffItems, takeoffZones, fileName ?? "sheet", {
                  packageStatus: takeoffPackageStatus,
                });
                downloadTakeoffCsv(`${base}-takeoff.csv`, csv);
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <Package className="h-3.5 w-3.5 text-slate-400" />
              Export takeoff CSV
            </button>
            <button
              type="button"
              disabled={!pdfUrl || !showTakeoff || takeoffItems.length === 0}
              onClick={() => {
                openTakeoffPrintReport(takeoffItems, takeoffZones, fileName ?? "sheet", {
                  packageStatus: takeoffPackageStatus,
                });
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              Print takeoff report
            </button>
            <button
              type="button"
              disabled={
                !pdfUrl ||
                !cloudFileVersionId ||
                !meHasProWorkspace(me ?? null) ||
                sheetIssuesPending ||
                sheetIssues.length === 0
              }
              onClick={() => {
                const csv = buildIssuesCsv(sheetIssues, fileName ?? "sheet");
                downloadIssuesCsv(`${base}-issues.csv`, csv);
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <Table className="h-3.5 w-3.5 text-slate-400" />
              Export issues CSV
            </button>
            <button
              type="button"
              disabled={
                !pdfUrl ||
                !cloudFileVersionId ||
                !meHasProWorkspace(me ?? null) ||
                sheetIssuesPending ||
                sheetIssues.length === 0
              }
              onClick={() => {
                openIssuesPrintReport(sheetIssues, fileName ?? "sheet");
                onClose();
              }}
              className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
            >
              <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
              Print issues report
            </button>
          </div>

          <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Browser print
          </p>
          <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
            Prints the live viewer (browser controls what appears). For a predictable burn-in, use
            Download PDF above.
          </p>
          <button
            type="button"
            disabled={!pdfUrl}
            onClick={() => {
              window.print();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-left text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5 text-slate-400" />
            Print sheet (browser)
          </button>
        </div>
      </div>
    </div>
  );
}

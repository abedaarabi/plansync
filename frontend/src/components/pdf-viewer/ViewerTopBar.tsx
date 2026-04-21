"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Hand,
  HelpCircle,
  Maximize2,
  MousePointer2,
  Redo2,
  Search,
  Settings,
  SquareSplitHorizontal,
  Trash2,
  Undo2,
  UserX,
  Info,
  BoxSelect,
  ZoomIn,
  ZoomOut,
  Menu,
  FileDown,
  FileText,
  Keyboard,
  Library,
  PanelLeft,
  X,
} from "lucide-react";
import { fetchMe, fetchProject, patchMeViewerPresence, putViewerState } from "@/lib/api-client";
import {
  defaultMeasureUnitForProject,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";
import { formatPageSizeTitle } from "@/lib/pagePaperInfo";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { VIEWER_LOCAL_PDF_INPUT_ID } from "@/lib/viewerLocalPdfInput";
import {
  calibrationFromPersisted,
  fileFingerprint,
  savePersistedSession,
} from "@/lib/sessionPersistence";
import { buildSessionBackupJson, parseSessionBackupJson, saveBookmarks } from "@/lib/viewBookmarks";
import { saveDisplayNameToStorage } from "@/lib/sessionPersistence";
import { useViewerStore, VIEWER_SCALE_MAX, VIEWER_SCALE_MIN } from "@/store/viewerStore";
import type { Tool } from "@/store/viewerStore";
import { toast } from "sonner";
import { useViewerCollabDesktop } from "@/hooks/useViewerCollabDesktop";
import { ClearPersistedMarkupDialog } from "./ClearPersistedMarkupDialog";
import { PdfSearchPopover } from "./PdfSearchPopover";
import { SheetExportDialog } from "./SheetExportDialog";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

const modeTools: {
  id: Tool;
  label: string;
  icon: typeof Hand;
  hint: string;
}[] = [
  { id: "pan", label: "Pan", icon: Hand, hint: "Pan & scroll (wheel)" },
  {
    id: "select",
    label: "Measure",
    icon: MousePointer2,
    hint: "Click to select, drag to move markups and measures",
  },
  {
    id: "zoomArea",
    label: "Zoom area",
    icon: BoxSelect,
    hint: "Drag a rectangle on the sheet to zoom in",
  },
];

function BarDivider() {
  return (
    <div className="h-6 w-px shrink-0 bg-[var(--viewer-chrome-border)] opacity-90" aria-hidden />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
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
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, ref]);
}

type TopBarProps = {
  pdfDoc?: PDFDocumentProxy | null;
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>;
};

export function ViewerTopBar({ pdfDoc = null, exportCanvasRef }: TopBarProps = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInfoRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const fileName = useViewerStore((s) => s.fileName);
  const fileSizeBytes = useViewerStore((s) => s.fileSizeBytes);
  const numPages = useViewerStore((s) => s.numPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const scale = useViewerStore((s) => s.scale);
  const zoomDisplayBaseScale = useViewerStore((s) => s.zoomDisplayBaseScale);
  const tool = useViewerStore((s) => s.tool);
  const displayName = useViewerStore((s) => s.displayName);
  const roomId = useViewerStore((s) => s.roomId);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const annotations = useViewerStore((s) => s.annotations);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const historyPastLen = useViewerStore((s) => s.historyPast.length);
  const historyFutureLen = useViewerStore((s) => s.historyFuture.length);

  const setPdf = useViewerStore((s) => s.setPdf);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const setScale = useViewerStore((s) => s.setScale);
  const setTool = useViewerStore((s) => s.setTool);
  const setDisplayName = useViewerStore((s) => s.setDisplayName);
  const setRoomId = useViewerStore((s) => s.setRoomId);
  const requestFit = useViewerStore((s) => s.requestFit);
  const undo = useViewerStore((s) => s.undo);
  const redo = useViewerStore((s) => s.redo);
  const clearPersistedMarkupForCurrentDocument = useViewerStore(
    (s) => s.clearPersistedMarkupForCurrentDocument,
  );
  const compareMode = useViewerStore((s) => s.compareMode);
  const setCompareMode = useViewerStore((s) => s.setCompareMode);
  const rightFlyout = useViewerStore((s) => s.rightFlyout);
  const toggleRightFlyout = useViewerStore((s) => s.toggleRightFlyout);
  const deleteAllMarkupsOnPage = useViewerStore((s) => s.deleteAllMarkupsOnPage);
  const deleteAllMarkupsInDocument = useViewerStore((s) => s.deleteAllMarkupsInDocument);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const setMeasureUnit = useViewerStore((s) => s.setMeasureUnit);
  const mobileLeftToolsOpen = useViewerStore((s) => s.mobileLeftToolsOpen);
  const toggleMobileLeftTools = useViewerStore((s) => s.toggleMobileLeftTools);

  const queryClient = useQueryClient();
  const { data: me, isPending: mePending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  const proBlocksLocalOpen = mePending || meHasProWorkspace(me ?? null);

  const { data: viewerProject } = useQuery({
    queryKey: qk.project(viewerProjectId ?? ""),
    queryFn: () => fetchProject(viewerProjectId!),
    enabled: Boolean(viewerProjectId) && meHasProWorkspace(me ?? null),
    staleTime: 60_000,
  });

  const collabDesktop = useViewerCollabDesktop();
  const workspaceCollabEnabled = useMemo(() => {
    if (!viewerProject?.workspaceId || !me?.workspaces) return true;
    const row = me.workspaces.find((w) => w.workspaceId === viewerProject.workspaceId);
    return row?.workspace.viewerCollaborationEnabled !== false;
  }, [viewerProject?.workspaceId, me?.workspaces]);

  const collabPresenceMenuVisible =
    collabDesktop &&
    workspaceCollabEnabled &&
    Boolean(cloudFileVersionId) &&
    meHasProWorkspace(me ?? null);

  useEffect(() => {
    if (!viewerProjectId || !viewerProject?.measurementSystem) return;
    setMeasureUnit(
      defaultMeasureUnitForProject(viewerProject.measurementSystem as ProjectMeasurementSystem),
    );
  }, [viewerProjectId, viewerProject?.measurementSystem, setMeasureUnit]);

  const materialsHubHref =
    viewerProject?.workspaceId != null
      ? `/workspaces/${viewerProject.workspaceId}/materials`
      : "/materials";

  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [docInfoOpen, setDocInfoOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clearMarkupDialogOpen, setClearMarkupDialogOpen] = useState(false);
  const [sheetExportOpen, setSheetExportOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [zoomStr, setZoomStr] = useState("100");
  const zoomPct = Math.max(
    1,
    Math.round((scale / Math.max(VIEWER_SCALE_MIN, zoomDisplayBaseScale || 1)) * 100),
  );

  useClickOutside(docInfoRef, docInfoOpen, () => setDocInfoOpen(false));
  useClickOutside(helpRef, helpOpen, () => setHelpOpen(false));
  useClickOutside(moreMenuRef, moreMenuOpen, () => setMoreMenuOpen(false));

  useEffect(() => {
    setZoomStr(String(zoomPct));
  }, [zoomPct]);

  const pagePaperTitle = useMemo(() => {
    if (!pdfUrl || numPages < 1) return null;
    const idx = currentPage - 1;
    const sz = pageSizePtByPage[idx];
    if (!sz) return null;
    return formatPageSizeTitle(sz.wPt, sz.hPt);
  }, [pdfUrl, numPages, currentPage, pageSizePtByPage]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (proBlocksLocalOpen) {
      e.target.value = "";
      return;
    }
    const f = e.target.files?.[0];
    if (!f?.type.includes("pdf")) return;
    const prev = useViewerStore.getState().pdfUrl;
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(f);
    setPdf(url, f.name, f.size);
    e.target.value = "";
  };

  const commitZoomFromInput = () => {
    const n = parseInt(zoomStr, 10);
    if (!Number.isFinite(n) || n < 1) {
      setZoomStr(String(zoomPct));
      return;
    }
    const pctMin = Math.max(1, Math.round((VIEWER_SCALE_MIN / zoomDisplayBaseScale) * 100));
    const pctMax = Math.max(1, Math.round((VIEWER_SCALE_MAX / zoomDisplayBaseScale) * 100));
    const pct = Math.min(pctMax, Math.max(pctMin, n));
    setScale((pct / 100) * zoomDisplayBaseScale);
    setZoomStr(String(pct));
  };

  const tb = (active: boolean) =>
    `viewer-focus-ring viewer-toolbar-btn ${active ? "viewer-toolbar-btn-active" : ""}`;

  const proProjectsNavClass =
    "viewer-focus-ring flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-[#334155] bg-[#1E293B] px-2.5 text-[11px] font-medium tracking-tight text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155] active:scale-[0.98] sm:min-h-7";

  const goBackOrProjects = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/projects");
    }
  };

  return (
    <header
      className="no-print relative flex h-10 shrink-0 items-stretch gap-0 border-b border-[#334155] bg-[#0F172A] text-[#F8FAFC]"
      role="banner"
    >
      <input
        id={VIEWER_LOCAL_PDF_INPUT_ID}
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />

      <div
        className="flex min-h-0 min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-2 py-1 [scrollbar-width:thin]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex shrink-0 items-center gap-2 border-r border-[#334155] pr-2.5">
          <div
            className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-[var(--viewer-primary)] text-[11px] font-bold text-white shadow-sm"
            aria-label="PlanSync"
            title="PlanSync"
          >
            PS
          </div>
          {pdfUrl ? (
            <button
              type="button"
              className={`viewer-focus-ring flex min-h-8 shrink-0 items-center justify-center rounded-md border border-[#334155] bg-[#1E293B] p-1.5 text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155] active:scale-[0.98] lg:hidden ${
                mobileLeftToolsOpen
                  ? "border-[var(--viewer-primary)]/50 bg-[#1e3a5f] text-white"
                  : ""
              }`}
              aria-label={
                mobileLeftToolsOpen ? "Close sheet tools sidebar" : "Open sheet tools sidebar"
              }
              aria-expanded={mobileLeftToolsOpen}
              title={mobileLeftToolsOpen ? "Close tools" : "Draw, measure, pages, outline"}
              onClick={() => toggleMobileLeftTools()}
            >
              {mobileLeftToolsOpen ? (
                <X className="h-4 w-4 shrink-0" strokeWidth={2} />
              ) : (
                <PanelLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
              )}
            </button>
          ) : null}
          {mePending ? (
            <button
              type="button"
              disabled
              title="Loading account"
              className="flex min-h-8 shrink-0 cursor-wait items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#1E293B] px-2.5 text-[11px] font-medium tracking-tight text-[#94A3B8] opacity-80 sm:min-h-7"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">Open</span>
            </button>
          ) : meHasProWorkspace(me ?? null) ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Back"
                aria-label="Back"
                onClick={goBackOrProjects}
                className={`${proProjectsNavClass} xl:hidden`}
              >
                <span className="text-[#94A3B8]" aria-hidden>
                  ←
                </span>
                <span className="hidden sm:inline">Back</span>
              </button>
              <Link
                href="/projects"
                title="Back to Projects"
                aria-label="Back to Projects"
                className={`${proProjectsNavClass} hidden xl:flex`}
              >
                <span className="text-[#94A3B8]" aria-hidden>
                  ←
                </span>
                <span className="hidden sm:inline">Projects</span>
              </Link>
              {viewerProjectId ? (
                <Link
                  href={materialsHubHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Material library — add or edit materials to assign in takeoff (opens in new tab)"
                  className="viewer-focus-ring flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-[#334155] bg-[#1E293B] px-2 text-[11px] font-medium tracking-tight text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155] active:scale-[0.98] sm:min-h-7"
                >
                  <Library className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="hidden sm:inline">Materials</span>
                </Link>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Open a PDF file from your device"
              className="viewer-focus-ring flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[var(--viewer-primary)] px-2.5 text-[11px] font-medium tracking-tight text-white shadow-[var(--viewer-primary-glow)] transition hover:bg-[var(--viewer-primary-hover)] active:scale-[0.98] sm:min-h-7"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">Open</span>
            </button>
          )}
        </div>

        <div
          className={`flex shrink-0 items-center gap-0.5 ${!pdfUrl ? "pointer-events-none opacity-40" : ""}`}
          role="toolbar"
          aria-label="Canvas tools"
        >
          {modeTools.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                aria-label={t.label}
                aria-pressed={active}
                disabled={!pdfUrl}
                onClick={() => setTool(t.id)}
                className={tb(active)}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>

        <BarDivider />

        <div className="flex min-w-[8rem] flex-1 justify-center px-1">
          <div
            className={`flex shrink-0 items-center gap-0.5 rounded-md border border-[#334155] bg-[#1E293B] p-0.5 ${!pdfUrl ? "pointer-events-none opacity-40" : ""}`}
          >
            <button
              type="button"
              disabled={!pdfUrl || currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="rounded p-1 text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-30"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3.25rem] text-center text-[11px] font-semibold tabular-nums tracking-tight text-[#F8FAFC]">
              {pdfUrl ? `${currentPage} / ${numPages || "—"}` : "—"}
            </span>
            <button
              type="button"
              disabled={!pdfUrl || currentPage >= numPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="rounded p-1 text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-30"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <BarDivider />

        <div
          className={`flex shrink-0 items-center gap-1.5 ${!pdfUrl ? "pointer-events-none opacity-40" : ""}`}
        >
          <div className="flex items-center gap-0.5 rounded-md border border-[#334155] bg-[#1E293B] p-0.5">
            <button
              type="button"
              disabled={!pdfUrl}
              onClick={() => setScale(scale / 1.2)}
              className="rounded p-1 text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-30"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              disabled={!pdfUrl}
              value={zoomStr}
              onChange={(e) => setZoomStr(e.target.value.replace(/\D/g, ""))}
              onBlur={commitZoomFromInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-6 w-10 rounded border border-transparent bg-transparent text-center text-[11px] font-semibold tabular-nums tracking-tight text-[#60A5FA] outline-none transition focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/35 disabled:opacity-40"
              title="Zoom %"
              aria-label="Zoom percentage"
            />
            <span className="pr-0.5 text-[10px] font-medium text-[#94A3B8]">%</span>
            <button
              type="button"
              disabled={!pdfUrl}
              onClick={() => setScale(scale * 1.2)}
              className="rounded p-1 text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-30"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className={`flex shrink-0 items-center gap-0.5 rounded-md border border-[#334155] bg-[#1E293B] p-0.5 ${!pdfUrl ? "pointer-events-none opacity-40" : ""}`}
            role="group"
            aria-label="Fit view"
          >
            <button
              type="button"
              disabled={!pdfUrl}
              title="Fit width"
              onClick={() => requestFit("width")}
              className="rounded p-1 text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-30"
              aria-label="Fit width"
            >
              <Maximize2 className="h-3.5 w-3.5 rotate-90" />
            </button>
          </div>

          <BarDivider />

          <button
            type="button"
            disabled={!pdfUrl || historyPastLen === 0}
            onClick={() => undo()}
            className={tb(false)}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!pdfUrl || historyFutureLen === 0}
            onClick={() => redo()}
            className={tb(false)}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              ref={searchBtnRef}
              type="button"
              disabled={!pdfUrl}
              onClick={() => setSearchOpen((o) => !o)}
              className={tb(searchOpen)}
              title="Search text in the document"
              aria-expanded={searchOpen}
              aria-label="Search in document"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <PdfSearchPopover
              pdfDoc={pdfDoc}
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              anchorRef={searchBtnRef}
            />
          </div>

          {pdfUrl ? (
            <>
              <BarDivider />
              <div
                className="flex shrink-0 items-center gap-0.5"
                role="toolbar"
                aria-label="Panels"
              >
                <button
                  type="button"
                  onClick={() => toggleRightFlyout()}
                  title="Sheet settings — map, snap, saved views, overlays"
                  aria-pressed={rightFlyout === "settings"}
                  className={tb(rightFlyout === "settings")}
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={!pdfUrl}
                  onClick={() => setCompareMode(!compareMode)}
                  title={
                    compareMode
                      ? "Exit compare mode"
                      : "Compare before (clean PDF) and after (with markups)"
                  }
                  aria-pressed={compareMode}
                  aria-label="Compare"
                  className={`viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 ${
                    compareMode
                      ? "viewer-toolbar-btn-active"
                      : "border-transparent bg-transparent text-[#94A3B8] hover:border-[#475569] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
                  }`}
                >
                  <SquareSplitHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div
        className="relative z-[70] flex shrink-0 items-center border-l border-[#334155] bg-[#0F172A] py-1 pl-2 pr-2"
        ref={moreMenuRef}
      >
        <button
          type="button"
          onClick={() => setMoreMenuOpen((o) => !o)}
          className={tb(moreMenuOpen || sheetExportOpen)}
          aria-expanded={moreMenuOpen}
          aria-haspopup="menu"
          aria-label="Sheet menu"
          title="Export, print, document, shortcuts"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        {moreMenuOpen ? (
          <div
            className="absolute right-0 top-full z-[85] mt-1 w-[min(calc(100vw-1rem),13rem)] min-w-[12rem] rounded-xl border border-[#334155] bg-[#1E293B] py-1 shadow-2xl ring-1 ring-black/25"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#F8FAFC] transition hover:bg-[#334155]"
              onClick={() => {
                setSheetExportOpen(true);
                setMoreMenuOpen(false);
              }}
            >
              <FileDown
                className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                strokeWidth={2}
                aria-hidden
              />
              Export & print
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#F8FAFC] transition hover:bg-[#334155]"
              onClick={() => {
                setDocInfoOpen(true);
                setHelpOpen(false);
                setMoreMenuOpen(false);
              }}
            >
              <FileText
                className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                strokeWidth={2}
                aria-hidden
              />
              Document info
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#F8FAFC] transition hover:bg-[#334155]"
              onClick={() => {
                setHelpOpen(true);
                setDocInfoOpen(false);
                setMoreMenuOpen(false);
              }}
            >
              <Keyboard
                className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                strokeWidth={2}
                aria-hidden
              />
              Shortcuts
            </button>
            {collabPresenceMenuVisible ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[#F8FAFC] transition hover:bg-[#334155]"
                onClick={() => {
                  void (async () => {
                    const hide = !me?.user.hideViewerPresence;
                    try {
                      await patchMeViewerPresence(hide);
                      await queryClient.invalidateQueries({ queryKey: qk.me() });
                      toast.success(
                        hide
                          ? "You are hidden from the viewer presence list."
                          : "Others can see you in the viewer again.",
                      );
                    } catch {
                      toast.error("Could not update presence.");
                    }
                  })();
                  setMoreMenuOpen(false);
                }}
              >
                <UserX
                  className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                  strokeWidth={2}
                  aria-hidden
                />
                {me?.user.hideViewerPresence ? "Show my presence on sheets" : "Hide my presence"}
              </button>
            ) : null}
          </div>
        ) : null}
        <SheetExportDialog
          open={sheetExportOpen}
          onClose={() => setSheetExportOpen(false)}
          pdfDoc={pdfDoc}
          exportCanvasRef={exportCanvasRef}
        />
      </div>

      <div className="relative" ref={docInfoRef}>
        {docInfoOpen && (
          <div
            className="fixed right-3 top-11 z-[60] max-h-[min(70vh,520px)] w-[min(calc(100vw-1rem),300px)] overflow-y-auto rounded-xl border border-[#334155] bg-[#1E293B] p-3 shadow-2xl ring-1 ring-black/25 [scrollbar-width:thin]"
            role="dialog"
            aria-label="Document information"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-400/85">
              Document
            </p>
            <dl className="mb-3 space-y-2 text-[11px] text-slate-300">
              <div className="rounded-md border border-slate-600/55 bg-slate-800/50 px-2 py-1.5">
                <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
                  File name
                </dt>
                <dd className="mt-0.5 break-all leading-snug text-slate-200">{fileName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-600/45 pb-1.5">
                <dt className="text-slate-500">File size</dt>
                <dd className="shrink-0 tabular-nums text-slate-200">
                  {fileSizeBytes != null ? formatFileSize(fileSizeBytes) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-600/45 pb-1.5">
                <dt className="text-slate-500">Pages</dt>
                <dd className="tabular-nums text-slate-200">{numPages > 0 ? numPages : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-600/45 pb-1.5">
                <dt className="text-slate-500">Current page</dt>
                <dd className="tabular-nums text-slate-200">
                  {pdfUrl && numPages > 0 ? `${currentPage} / ${numPages}` : "—"}
                </dd>
              </div>
              {pagePaperTitle && (
                <div>
                  <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
                    This page size
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-slate-300">
                    {pagePaperTitle}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2 border-b border-slate-600/45 pb-1.5">
                <dt className="text-slate-500">Zoom</dt>
                <dd className="tabular-nums text-blue-400">{zoomPct}%</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-600/45 pb-1.5">
                <dt className="text-slate-500">Markups</dt>
                <dd className="tabular-nums text-slate-200">{annotations.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Calibrated pages</dt>
                <dd className="tabular-nums text-slate-200">
                  {Object.keys(calibrationByPage).length}
                </dd>
              </div>
            </dl>

            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Drawing markups
            </p>
            <div className="mb-3 flex flex-col gap-1.5">
              <button
                type="button"
                disabled={!pdfUrl || numPages < 1}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Remove all pen, shapes, highlights, and text on this page? Measurements are kept.",
                    )
                  ) {
                    return;
                  }
                  deleteAllMarkupsOnPage(currentPage - 1);
                }}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-2 py-1.5 text-[10px] font-medium text-slate-200 transition hover:bg-slate-700/75 disabled:opacity-40"
              >
                Clear drawings on this page
              </button>
              <button
                type="button"
                disabled={!pdfUrl || numPages < 1}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Remove all drawing markups on every page? Measurements are kept.",
                    )
                  ) {
                    return;
                  }
                  deleteAllMarkupsInDocument();
                }}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-2 py-1.5 text-[10px] font-medium text-slate-200 transition hover:bg-slate-700/75 disabled:opacity-40"
              >
                Clear all drawings (all pages)
              </button>
            </div>

            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Backup &amp; restore
            </p>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                setBackupError(null);
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const text = typeof reader.result === "string" ? reader.result : "";
                  const parsed = parseSessionBackupJson(text);
                  if (!parsed) {
                    setBackupError("Invalid backup file.");
                    return;
                  }
                  const s = useViewerStore.getState();
                  if (!s.fileName || s.numPages < 1) return;
                  const fp = fileFingerprint(s.fileName, s.numPages);
                  if (parsed.session.fingerprint !== fp) {
                    setBackupError("This backup is for a different PDF (name or page count).");
                    return;
                  }
                  useViewerStore.setState({
                    annotations: parsed.session.annotations,
                    calibrationByPage: calibrationFromPersisted(parsed.session.calibrationByPage),
                    currentPage: Math.min(s.numPages, Math.max(1, parsed.session.currentPage)),
                    scale: Math.min(
                      VIEWER_SCALE_MAX,
                      Math.max(VIEWER_SCALE_MIN, parsed.session.scale),
                    ),
                    measureUnit: parsed.session.measureUnit ?? s.measureUnit,
                    snapToGeometry: parsed.session.snapToGeometry ?? s.snapToGeometry,
                    snapRadiusPx: parsed.session.snapRadiusPx ?? s.snapRadiusPx,
                    ...(parsed.session.takeoffItems != null
                      ? { takeoffItems: parsed.session.takeoffItems }
                      : {}),
                    ...(parsed.session.takeoffZones != null
                      ? { takeoffZones: parsed.session.takeoffZones }
                      : {}),
                    ...(parsed.session.takeoffPackageStatus != null
                      ? { takeoffPackageStatus: parsed.session.takeoffPackageStatus }
                      : {}),
                    historyPast: [],
                    historyFuture: [],
                    selectedAnnotationIds: [],
                  });
                  const ns = useViewerStore.getState();
                  savePersistedSession({
                    fingerprint: fp,
                    currentPage: ns.currentPage,
                    scale: ns.scale,
                    annotations: ns.annotations,
                    calibrationByPage: Object.fromEntries(
                      Object.entries(ns.calibrationByPage).map(([k, v]) => [String(k), v]),
                    ),
                    measureUnit: ns.measureUnit,
                    snapToGeometry: ns.snapToGeometry,
                    snapRadiusPx: ns.snapRadiusPx,
                    takeoffItems: ns.takeoffItems,
                    takeoffZones: ns.takeoffZones,
                    takeoffPackageStatus: ns.takeoffPackageStatus,
                  });
                  const cfv = ns.cloudFileVersionId;
                  if (cfv) {
                    void putViewerState(
                      cfv,
                      {
                        annotations: ns.annotations,
                        calibrationByPage: Object.fromEntries(
                          Object.entries(ns.calibrationByPage).map(([k, v]) => [String(k), v]),
                        ),
                        currentPage: ns.currentPage,
                        scale: ns.scale,
                        measureUnit: ns.measureUnit,
                        snapToGeometry: ns.snapToGeometry,
                        snapRadiusPx: ns.snapRadiusPx,
                        takeoffItems: ns.takeoffItems,
                        takeoffZones: ns.takeoffZones,
                        takeoffPackageStatus: ns.takeoffPackageStatus,
                      },
                      { skipRevisionCheck: true },
                    ).catch(() => {});
                  }
                  if (parsed.bookmarks?.length) {
                    saveBookmarks(s.fileName, s.numPages, parsed.bookmarks);
                  }
                };
                reader.readAsText(f);
              }}
            />
            <div className="mb-3 flex flex-col gap-1.5">
              <button
                type="button"
                disabled={!pdfUrl || numPages < 1}
                onClick={() => {
                  const s = useViewerStore.getState();
                  const json = buildSessionBackupJson({
                    fileName: s.fileName,
                    numPages: s.numPages,
                    currentPage: s.currentPage,
                    scale: s.scale,
                    annotations: s.annotations,
                    calibrationByPage: s.calibrationByPage,
                    measureUnit: s.measureUnit,
                    snapToGeometry: s.snapToGeometry,
                    snapRadiusPx: s.snapRadiusPx,
                    displayName: s.displayName,
                    takeoffItems: s.takeoffItems,
                    takeoffZones: s.takeoffZones,
                    takeoffPackageStatus: s.takeoffPackageStatus,
                  });
                  const blob = new Blob([json], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  const base = (s.fileName ?? "session").replace(/\.pdf$/i, "");
                  a.download = `${base}-plansync-backup.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-2 py-1.5 text-[10px] font-medium text-slate-200 transition hover:bg-slate-700/75 disabled:opacity-40"
              >
                Download session JSON
              </button>
              <button
                type="button"
                disabled={!pdfUrl || numPages < 1}
                onClick={() => backupInputRef.current?.click()}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-2 py-1.5 text-[10px] font-medium text-slate-200 transition hover:bg-slate-700/75 disabled:opacity-40"
              >
                Restore from JSON
              </button>
              {backupError && (
                <p className="text-[10px] leading-snug text-red-400">{backupError}</p>
              )}
            </div>

            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Saved in this browser
            </p>
            <p className="mb-2 text-[10px] leading-snug text-slate-500">
              Markups, calibration, zoom, and page for this file are stored in{" "}
              <strong className="font-medium text-slate-400">local storage</strong> on this device
              only—not on a server.
            </p>
            <button
              type="button"
              disabled={!pdfUrl || numPages < 1}
              onClick={() => setClearMarkupDialogOpen(true)}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2 py-2 text-[11px] font-medium text-red-200 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Clear saved markups &amp; calibration
            </button>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Session & sync
            </p>
            <label className="mb-3 block text-[11px] text-slate-500">
              Display name
              <input
                type="text"
                value={displayName}
                title="Author name stored on new markups"
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  saveDisplayNameToStorage(e.target.value);
                }}
                className="mt-1 w-full rounded-md border border-slate-600/70 bg-slate-800/80 px-2 py-1.5 text-[11px] text-slate-100"
              />
            </label>
            <label className="block text-[11px] text-slate-500">
              Room ID
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                title="Same ID in this browser syncs annotations across tabs"
                className="mt-1 w-full rounded-md border border-slate-600/70 bg-slate-800/80 px-2 py-1.5 text-[11px] text-slate-100"
              />
            </label>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Same room ID in this browser syncs markups across tabs in real time.
            </p>
          </div>
        )}
      </div>

      <div className="relative" ref={helpRef}>
        {helpOpen && (
          <div
            className="fixed right-3 top-11 z-[60] w-[min(calc(100vw-1rem),320px)] rounded-xl border border-[#334155] bg-[#1E293B] p-3 text-[11px] leading-relaxed text-[#94A3B8] shadow-2xl ring-1 ring-black/25"
            role="tooltip"
          >
            <p className="mb-2 font-semibold text-[#F8FAFC]">Shortcuts</p>
            <p>
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Esc
              </kbd>{" "}
              or right-click cancels in-progress markup, measure, or calibrate.
            </p>
            <p className="mt-2">
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Ctrl+Z
              </kbd>{" "}
              undo markup / calibration;{" "}
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Ctrl+Shift+Z
              </kbd>{" "}
              redo.
            </p>
            <p className="mt-2">
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Enter
              </kbd>{" "}
              places a line segment when both ends are set, or ends the chain when only the start is
              set. Area / path: closes when enough points are set.
            </p>
            <p className="mt-2">
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Delete
              </kbd>{" "}
              or{" "}
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Backspace
              </kbd>{" "}
              removes the selected item (Measure mode).
            </p>
            <p className="mt-3 border-t border-slate-600/45 pt-3 font-semibold text-slate-200">
              Measure &amp; snap
            </p>
            <p className="mt-2">
              Hold <kbd className="viewer-kbd">Alt</kbd> to ignore PDF snap (exact pixel). Hold{" "}
              <kbd className="viewer-kbd">Shift</kbd> to constrain the segment to horizontal or
              vertical.
            </p>
            <p className="mt-2">
              Line ruler: drag the start or end handle, or the segment itself, to reposition before
              you place. Second click fixes the segment; move the pointer to slide the dimension
              line in or out, then click or{" "}
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Enter
              </kbd>{" "}
              to place. The next segment starts from that end.{" "}
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Enter
              </kbd>{" "}
              with only the first point stops the chain.
            </p>
            <p className="mt-2 text-slate-500">
              With Ruler or Calibrate active, scroll the wheel over the page to zoom toward the
              cursor (no Ctrl). Use scrollbars to pan.
            </p>
            <p className="mt-2 text-slate-500">
              Pinch-zoom (trackpad) or{" "}
              <kbd className="rounded border border-slate-500/60 bg-slate-700/90 px-1 font-mono text-slate-200">
                Ctrl
              </kbd>{" "}
              + wheel zooms. Session (markups, zoom, page) saves for the same file name in this
              browser.
            </p>
            <p className="mt-2 text-slate-500">
              Zoom ranges from {Math.round(VIEWER_SCALE_MIN * 100)}% to{" "}
              {Math.round(VIEWER_SCALE_MAX * 100)}%.
            </p>
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-slate-600/60 bg-slate-800/85 py-2 text-[11px] font-medium text-slate-100 transition hover:bg-slate-700/90"
              onClick={() => {
                setShortcutsOpen(true);
                setHelpOpen(false);
              }}
            >
              Full keyboard reference
            </button>
          </div>
        )}
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ClearPersistedMarkupDialog
        open={clearMarkupDialogOpen}
        onCancel={() => setClearMarkupDialogOpen(false)}
        onConfirm={() => {
          clearPersistedMarkupForCurrentDocument();
          setClearMarkupDialogOpen(false);
        }}
      />
    </header>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CloudOff,
  FileText,
  Library,
  Loader2,
  MoreHorizontal,
  Pencil,
  PencilLine,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  deleteOmInspectionRun,
  deleteOmInspectionTemplate,
  deleteOmWorkspaceInspectionTemplate,
  fetchOmInspectionRuns,
  fetchOmInspectionTemplates,
  fetchOmWorkspaceInspectionTemplates,
  omInspectionRunReportPdfUrl,
  postOmInspectionRun,
  postOmInspectionTemplateFromWorkspace,
  postOmWorkspaceInspectionTemplate,
  ProRequiredError,
  type OmInspectionChecklistItem,
  type OmInspectionRunRow,
  type OmInspectionTemplateRow,
  type OmWorkspaceInspectionTemplateRow,
} from "@/lib/api-client";
import { listOmInspectionOfflineDrafts } from "@/lib/omInspectionOfflineDraft";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmAssigneeAvatar } from "@/components/enterprise/OmAssigneePicker";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmInspectionRunSlideOver } from "@/components/enterprise/OmInspectionRunSlideOver";
import { OmInspectionTemplateSlideOver } from "@/components/enterprise/OmInspectionTemplateSlideOver";

type Props = { projectId: string };
type RunFilter = "all" | "open" | "closed" | "deficient";

function checklistStats(checklistJson: unknown): { items: number; sections: number } {
  if (!Array.isArray(checklistJson)) return { items: 0, sections: 0 };
  const levels = new Set<string>();
  let items = 0;
  for (const x of checklistJson) {
    if (!x || typeof x !== "object") continue;
    const o = x as { id?: unknown; level?: unknown };
    if (typeof o.id !== "string") continue;
    items += 1;
    const level = typeof o.level === "string" && o.level.trim() ? o.level.trim() : "1";
    levels.add(level);
  }
  return { items, sections: levels.size };
}

function runHasFail(r: OmInspectionRunRow): boolean {
  if (!Array.isArray(r.resultJson)) return false;
  return r.resultJson.some(
    (x) => x && typeof x === "object" && (x as { outcome?: string }).outcome === "fail",
  );
}

function runProgress(r: OmInspectionRunRow): number | null {
  if (r.status !== "DRAFT" || !Array.isArray(r.resultJson)) return null;
  const rows = r.resultJson.filter((x) => x && typeof x === "object") as {
    outcome?: string | null;
  }[];
  if (rows.length === 0) return 0;
  const answered = rows.filter(
    (x) => x.outcome === "pass" || x.outcome === "fail" || x.outcome === "na",
  ).length;
  return Math.round((answered / rows.length) * 100);
}

function runStatusUi(r: OmInspectionRunRow): {
  Icon: typeof CheckCircle2;
  label: string;
  badgeClass: string;
} {
  if (r.status.toUpperCase() === "DRAFT") {
    return {
      Icon: PencilLine,
      label: "Open",
      badgeClass: "enterprise-badge-warning",
    };
  }
  if (runHasFail(r)) {
    return {
      Icon: AlertTriangle,
      label: "Deficient",
      badgeClass: "enterprise-badge-danger",
    };
  }
  return {
    Icon: CheckCircle2,
    label: "Conforming",
    badgeClass: "enterprise-badge-success",
  };
}

function StatusBadge({ r }: { r: OmInspectionRunRow }) {
  const st = runStatusUi(r);
  const StIcon = st.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold ${st.badgeClass}`}
    >
      <StIcon className="h-3 w-3" strokeWidth={2} aria-hidden />
      {st.label}
    </span>
  );
}

function matchesSearch(
  q: string,
  opts: { templateName?: string; inspector?: string; statusLabel?: string },
) {
  if (!q) return true;
  const hay = [opts.templateName, opts.inspector, opts.statusLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function templateDueBadge(t: OmInspectionTemplateRow): {
  label: string;
  className: string;
} | null {
  if (!t.nextDueAt) return null;
  const due = new Date(t.nextDueAt);
  if (Number.isNaN(due.getTime())) return null;
  const now = Date.now();
  const dueMs = due.getTime();
  const label = due.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  if (dueMs < now) {
    return {
      label: `Overdue · ${label}`,
      className: "enterprise-badge-danger",
    };
  }
  const week = 7 * 24 * 60 * 60 * 1000;
  if (dueMs - now <= week) {
    return {
      label: `Due ${label}`,
      className: "enterprise-badge-warning",
    };
  }
  return {
    label: `Next ${label}`,
    className: "enterprise-badge-neutral",
  };
}

function TemplateMenu({
  template,
  onEdit,
  onDelete,
  onPublish,
  deleting,
  publishing,
}: {
  template: OmInspectionTemplateRow;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  deleting: boolean;
  publishing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuW = 176;
      const menuH = 132;
      const pad = 8;
      let top = rect.bottom + 4;
      if (top + menuH > window.innerHeight - pad) {
        top = Math.max(pad, rect.top - menuH - 4);
      }
      const left = Math.min(Math.max(pad, rect.right - menuW), window.innerWidth - menuW - pad);
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      // fallow-ignore-next-line code-duplication
      setOpen(false);
    };
    // fallow-ignore-next-line code-duplication
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[11rem] overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-[var(--enterprise-shadow-floating)]"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={publishing}
              onClick={() => {
                setOpen(false);
                onPublish();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" />
              Publish to company
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`More actions for ${template.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </>
  );
}

// fallow-ignore-next-line complexity
export function OmInspectionsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const { primary } = useEnterpriseWorkspace();
  const workspaceId = primary?.workspace.id;
  const [templateSlideOpen, setTemplateSlideOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OmInspectionTemplateRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [companyTemplateSlideOpen, setCompanyTemplateSlideOpen] = useState(false);
  const [activeRun, setActiveRun] = useState<OmInspectionRunRow | null>(null);
  const [runSlideOpen, setRunSlideOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim().toLowerCase()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const refresh = () => setOfflineDraftCount(listOmInspectionOfflineDrafts(projectId).length);
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [projectId, runSlideOpen]);

  const { data: templates = [], isPending: tp } = useQuery({
    queryKey: qk.omInspectionTemplates(projectId),
    queryFn: () => fetchOmInspectionTemplates(projectId),
  });

  const { data: runs = [], isPending: rp } = useQuery({
    queryKey: qk.omInspectionRuns(projectId),
    queryFn: () => fetchOmInspectionRuns(projectId),
  });

  const { data: workspaceTemplates = [], isPending: wtp } = useQuery({
    queryKey: qk.omWorkspaceInspectionTemplates(workspaceId ?? ""),
    queryFn: () => fetchOmWorkspaceInspectionTemplates(workspaceId!),
    enabled: Boolean(workspaceId) && libraryOpen,
  });

  const startRun = useMutation({
    mutationFn: (templateId: string) =>
      postOmInspectionRun(projectId, { templateId, resultJson: [] }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      setPickerOpen(false);
      setPickerQ("");
      setActiveRun(row);
      setRunSlideOpen(true);
      toast.success("Inspection started.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (templateId: string) => deleteOmInspectionTemplate(projectId, templateId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionTemplates(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      toast.success("Template deleted.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const publishToCompanyMut = useMutation({
    mutationFn: (t: OmInspectionTemplateRow) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      const checklistJson = Array.isArray(t.checklistJson)
        ? (t.checklistJson as OmInspectionChecklistItem[])
        : [];
      return postOmWorkspaceInspectionTemplate(workspaceId, {
        name: t.name,
        description: t.description,
        frequency: t.frequency,
        checklistJson,
      });
    },
    onSuccess: async () => {
      if (workspaceId) {
        await qc.invalidateQueries({ queryKey: qk.omWorkspaceInspectionTemplates(workspaceId) });
      }
      toast.success("Published to company library.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const cloneFromWorkspaceMut = useMutation({
    mutationFn: (workspaceTemplateId: string) =>
      postOmInspectionTemplateFromWorkspace(projectId, { workspaceTemplateId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionTemplates(projectId) });
      toast.success("Imported into this project.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteWorkspaceTplMut = useMutation({
    mutationFn: (templateId: string) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return deleteOmWorkspaceInspectionTemplate(workspaceId, templateId);
    },
    onSuccess: async () => {
      if (workspaceId) {
        await qc.invalidateQueries({ queryKey: qk.omWorkspaceInspectionTemplates(workspaceId) });
      }
      toast.success("Removed from company library.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteRunMut = useMutation({
    mutationFn: (runId: string) => deleteOmInspectionRun(projectId, runId),
    onSuccess: async (_, runId) => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      if (activeRun?.id === runId) {
        setActiveRun(null);
        setRunSlideOpen(false);
      }
      toast.success("Inspection deleted.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const runsByTemplate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) m.set(r.templateId, (m.get(r.templateId) ?? 0) + 1);
    return m;
  }, [runs]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t) =>
        matchesSearch(debouncedQ, {
          templateName: t.name,
          inspector: t.description ?? undefined,
          statusLabel: t.frequency ?? undefined,
        }),
      ),
    [templates, debouncedQ],
  );

  const numberedRuns = useMemo(() => {
    const sorted = [...runs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted.map((r, i) => ({ r, num: sorted.length - i }));
  }, [runs]);

  const filteredRunRows = useMemo(() => {
    return numberedRuns.filter(({ r }) => {
      const st = runStatusUi(r);
      if (
        !matchesSearch(debouncedQ, {
          templateName: r.template.name,
          inspector: r.createdBy?.name ?? undefined,
          statusLabel: st.label,
        })
      ) {
        return false;
      }
      if (runFilter === "open") return r.status === "DRAFT";
      if (runFilter === "closed") return r.status !== "DRAFT";
      if (runFilter === "deficient") return r.status !== "DRAFT" && runHasFail(r);
      return true;
    });
  }, [numberedRuns, debouncedQ, runFilter]);

  const openCount = useMemo(() => runs.filter((r) => r.status === "DRAFT").length, [runs]);
  const deficientCount = useMemo(
    () => runs.filter((r) => r.status !== "DRAFT" && runHasFail(r)).length,
    [runs],
  );

  const openRun = (r: OmInspectionRunRow) => {
    setActiveRun(r);
    setRunSlideOpen(true);
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateSlideOpen(true);
  };

  const openEditTemplate = (t: OmInspectionTemplateRow) => {
    setEditingTemplate(t);
    setTemplateSlideOpen(true);
  };

  const openNewInspection = () => {
    if (templates.length === 0) openCreateTemplate();
    else setPickerOpen(true);
  };

  const pickerFiltered = useMemo(() => {
    const q = pickerQ.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.frequency ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }, [templates, pickerQ]);

  const isPending = tp || rp;
  if (isPending) {
    return <EnterpriseLoadingState message="Loading inspections…" label="Loading" />;
  }

  const activeTemplate = activeRun
    ? templates.find((t) => t.id === activeRun.templateId)
    : undefined;

  const searchActive = Boolean(debouncedQ);
  const noMatches = searchActive && filteredTemplates.length === 0 && filteredRunRows.length === 0;

  const filterChips: { id: RunFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: runs.length },
    { id: "open", label: "Open", count: openCount },
    { id: "closed", label: "Closed", count: runs.length - openCount },
    { id: "deficient", label: "Deficient", count: deficientCount },
  ];

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={ClipboardCheck}
        title="Inspections"
        description="Run field checklists from templates — record pass/fail, photos, and PDF reports."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {workspaceId ? (
              <EnterpriseButton size="sm" variant="secondary" onClick={() => setLibraryOpen(true)}>
                <Library className="h-4 w-4" strokeWidth={2} />
                Company library
              </EnterpriseButton>
            ) : null}
            <EnterpriseButton
              size="sm"
              disabled={startRun.isPending}
              loading={startRun.isPending}
              onClick={openNewInspection}
            >
              {!startRun.isPending ? <Plus className="h-4 w-4" strokeWidth={2.5} /> : null}
              Create inspection
            </EnterpriseButton>
          </div>
        }
      />

      {offlineDraftCount > 0 ? (
        <div className="enterprise-alert-info flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {offlineDraftCount} offline draft{offlineDraftCount === 1 ? "" : "s"} on this device —
            open the inspection to sync when online.
          </p>
        </div>
      ) : null}

      {templates.length > 0 || runs.length > 0 ? (
        <div className="enterprise-card flex items-center gap-2 px-3 py-2 sm:px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
          <label className="sr-only" htmlFor="insp-list-search">
            Search inspections
          </label>
          <input
            id="insp-list-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search templates or inspections…"
            className="min-h-10 w-full bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
          />
        </div>
      ) : null}

      {noMatches ? (
        <div className="enterprise-card px-4 py-8 text-center text-sm text-[var(--enterprise-text-muted)]">
          No templates or inspections match your search.
        </div>
      ) : null}

      {/* Compact template library (Procore/Dalux style) */}
      {!noMatches ? (
        <section className="enterprise-card flex flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
                Checklist templates
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                Reusable forms used to start inspections
                {searchActive ? " · matching search" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateTemplate}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-xs font-semibold text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
                <ClipboardList className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--enterprise-text)]">
                No templates yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--enterprise-text-muted)]">
                Create a checklist template with sections and line items, then start inspections
                from it.
              </p>
              <EnterpriseButton size="sm" className="mt-3" onClick={openCreateTemplate}>
                <Plus className="h-4 w-4" />
                Create template
              </EnterpriseButton>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[var(--enterprise-text-muted)]">
              No templates match your search.
            </p>
          ) : (
            <ul className="enterprise-scrollbar max-h-[min(42vh,360px)] space-y-1.5 overflow-y-auto overscroll-contain p-2 sm:p-3">
              {filteredTemplates.map((t) => {
                const stats = checklistStats(t.checklistJson);
                const used = runsByTemplate.get(t.id) ?? 0;
                const due = templateDueBadge(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-2.5 py-2.5 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:bg-[var(--enterprise-hover-surface)]/60 sm:gap-3 sm:px-3"
                  >
                    <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] sm:inline-flex">
                      <ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditTemplate(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                          {t.name}
                        </p>
                        {due ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold ${due.className}`}
                          >
                            {due.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--enterprise-text-muted)]">
                        {[
                          t.frequency || null,
                          stats.sections
                            ? `${stats.sections} section${stats.sections === 1 ? "" : "s"}`
                            : null,
                          `${stats.items} item${stats.items === 1 ? "" : "s"}`,
                          used > 0 ? `${used} run${used === 1 ? "" : "s"}` : "Unused",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={startRun.isPending}
                      title="Start inspection"
                      onClick={() => startRun.mutate(t.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--enterprise-primary)] px-3 text-[11px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" fill="currentColor" />
                      Start
                    </button>
                    <TemplateMenu
                      template={t}
                      onEdit={() => openEditTemplate(t)}
                      publishing={publishToCompanyMut.isPending}
                      onPublish={() => publishToCompanyMut.mutate(t)}
                      deleting={deleteTemplateMut.isPending}
                      onDelete={() => {
                        if (
                          !window.confirm(
                            `Delete template “${t.name}”? All inspection runs that use it will be removed.`,
                          )
                        )
                          return;
                        deleteTemplateMut.mutate(t.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* Inspection activity — primary work surface */}
      {!noMatches ? (
        <section className="enterprise-card flex flex-col overflow-hidden p-3 sm:p-4">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Inspections</h2>
              <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                Open drafts and closed reports
                {searchActive ? " · matching search" : ""}
              </p>
            </div>
          </div>

          <div className="mt-3 flex shrink-0 flex-wrap gap-1.5">
            {filterChips.map((chip) => {
              const active = runFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setRunFilter(chip.id)}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                    active
                      ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                      : "border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                  }`}
                >
                  {chip.label}
                  {typeof chip.count === "number" ? (
                    <span
                      className={`tabular-nums ${active ? "text-white/80" : "text-[var(--enterprise-text-muted)]"}`}
                    >
                      {chip.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {runs.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                No inspections yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--enterprise-text-muted)]">
                Start from a template, walk the checklist in the field, then close with a PDF
                report.
              </p>
              {templates.length > 0 ? (
                <EnterpriseButton size="sm" className="mt-3" onClick={openNewInspection}>
                  <Plus className="h-4 w-4" />
                  Create inspection
                </EnterpriseButton>
              ) : null}
            </div>
          ) : filteredRunRows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--enterprise-text-muted)]">
              No inspections in this filter.
            </p>
          ) : (
            <>
              <ul className="enterprise-scrollbar mt-3 max-h-[min(52vh,520px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 lg:hidden">
                {filteredRunRows.slice(0, 50).map(({ r, num }) => {
                  const by = r.createdBy?.name ?? "—";
                  const dateStr = new Date(r.updatedAt).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                  });
                  const progress = runProgress(r);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openRun(r)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-3 text-left active:opacity-90"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-semibold text-[var(--enterprise-text-muted)]">
                              #{num}
                            </span>
                            <StatusBadge r={r} />
                            {progress != null ? (
                              <span className="text-[10px] font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
                                {progress}%
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                            {r.template.name}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--enterprise-text-muted)]">
                            <OmAssigneeAvatar member={r.createdBy} />
                            <span className="truncate">
                              {by} · {dateStr}
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="enterprise-scrollbar mobile-table-wrap mt-3 hidden max-h-[min(52vh,520px)] overflow-auto overscroll-contain lg:block">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--enterprise-surface)]">
                    <tr className="border-b border-[var(--enterprise-border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Inspection</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Inspector</th>
                      <th className="px-2 py-2">Updated</th>
                      <th className="px-2 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRunRows.slice(0, 50).map(({ r, num }) => {
                      const by = r.createdBy?.name ?? "—";
                      const dateStr = new Date(r.updatedAt).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                      const progress = runProgress(r);
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--enterprise-border)]/70 hover:bg-[var(--enterprise-hover-surface)]/40"
                        >
                          <td className="px-2 py-2.5 font-mono text-xs text-[var(--enterprise-text-muted)]">
                            {num}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => openRun(r)}
                              className="text-left font-medium text-[var(--enterprise-text)] hover:underline"
                            >
                              {r.template.name}
                            </button>
                            {progress != null ? (
                              <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                                {progress}% complete
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusBadge r={r} />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <OmAssigneeAvatar member={r.createdBy} />
                              <span className="truncate text-xs text-[var(--enterprise-text-muted)]">
                                {by}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 tabular-nums text-xs text-[var(--enterprise-text-muted)]">
                            {dateStr}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {r.status !== "DRAFT" ? (
                                <a
                                  href={omInspectionRunReportPdfUrl(projectId, r.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  PDF
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openRun(r)}
                                className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
                              >
                                {r.status === "DRAFT" ? "Continue" : "Open"}
                              </button>
                              <button
                                type="button"
                                disabled={deleteRunMut.isPending && deleteRunMut.variables === r.id}
                                aria-label="Delete inspection"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "Delete this inspection? PDF and data will be removed.",
                                    )
                                  )
                                    return;
                                  deleteRunMut.mutate(r.id);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-40"
                              >
                                {deleteRunMut.isPending && deleteRunMut.variables === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      <OmInspectionTemplateSlideOver
        projectId={projectId}
        open={templateSlideOpen}
        template={editingTemplate}
        onClose={() => {
          setTemplateSlideOpen(false);
          setEditingTemplate(null);
        }}
      />

      {workspaceId ? (
        <OmInspectionTemplateSlideOver
          scope="company"
          workspaceId={workspaceId}
          open={companyTemplateSlideOpen}
          onClose={() => setCompanyTemplateSlideOpen(false)}
        />
      ) : null}

      {activeRun ? (
        <OmInspectionRunSlideOver
          projectId={projectId}
          run={activeRun}
          template={activeTemplate}
          open={runSlideOpen}
          onClose={() => {
            setRunSlideOpen(false);
            setActiveRun(null);
          }}
        />
      ) : null}

      <EnterpriseSlideOver
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerQ("");
        }}
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),400px)]"
        panelVariant="floating"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        overlayZClass="z-[110]"
        ariaLabelledBy="pick-tpl-title"
        header={
          <div className="min-w-0">
            <h2 id="pick-tpl-title" className="text-lg font-semibold text-[var(--enterprise-text)]">
              Create inspection
            </h2>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Choose a checklist template to start a new run.
            </p>
          </div>
        }
        bodyClassName="px-3 py-3"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3"
        footer={
          <EnterpriseButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => {
              setPickerOpen(false);
              setPickerQ("");
            }}
          >
            Cancel
          </EnterpriseButton>
        }
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-1.5">
          <Search className="h-4 w-4 text-[var(--enterprise-text-muted)]" aria-hidden />
          <input
            value={pickerQ}
            onChange={(e) => setPickerQ(e.target.value)}
            placeholder="Search templates…"
            className="min-h-9 w-full bg-transparent text-sm outline-none placeholder:text-[var(--enterprise-text-muted)]"
            aria-label="Search templates"
          />
        </div>
        <ul className="max-h-[min(50vh,360px)] overflow-y-auto mobile-scroll">
          {pickerFiltered.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
              No templates match.
            </li>
          ) : (
            pickerFiltered.map((t) => {
              const stats = checklistStats(t.checklistJson);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={startRun.isPending}
                    onClick={() => startRun.mutate(t.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--enterprise-text)]">
                        {t.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[var(--enterprise-text-muted)]">
                        {[
                          t.frequency,
                          `${stats.sections} section${stats.sections === 1 ? "" : "s"}`,
                          `${stats.items} items`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </EnterpriseSlideOver>

      <EnterpriseSlideOver
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),420px)]"
        panelVariant="floating"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        overlayZClass="z-[110]"
        ariaLabelledBy="company-lib-title"
        header={
          <div className="min-w-0">
            <h2
              id="company-lib-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Company library
            </h2>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Create shared checklists here, then import them into any project.
            </p>
          </div>
        }
        bodyClassName="px-3 py-3"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3"
        footer={
          <div className="flex w-full flex-col gap-2">
            <EnterpriseButton size="lg" fullWidth onClick={() => setCompanyTemplateSlideOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Create company template
            </EnterpriseButton>
            <EnterpriseButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => setLibraryOpen(false)}
            >
              Done
            </EnterpriseButton>
          </div>
        }
      >
        {wtp ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
            Loading company templates…
          </p>
        ) : workspaceTemplates.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm font-medium text-[var(--enterprise-text)]">
              No company templates yet
            </p>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Create one below, or publish a project template with “Publish to company”.
            </p>
            <EnterpriseButton
              className="mt-4"
              size="sm"
              onClick={() => setCompanyTemplateSlideOpen(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Create company template
            </EnterpriseButton>
          </div>
        ) : (
          <ul className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto mobile-scroll">
            {workspaceTemplates.map((t: OmWorkspaceInspectionTemplateRow) => {
              const stats = checklistStats(t.checklistJson);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--enterprise-hover-surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                      {[t.frequency, `${stats.items} item${stats.items === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cloneFromWorkspaceMut.isPending}
                    onClick={() => cloneFromWorkspaceMut.mutate(t.id)}
                    className="inline-flex min-h-8 items-center rounded-lg border border-[var(--enterprise-border)] px-2.5 text-[11px] font-semibold text-[var(--enterprise-primary)] disabled:opacity-50"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    disabled={deleteWorkspaceTplMut.isPending}
                    onClick={() => {
                      if (!window.confirm(`Remove “${t.name}” from the company library?`)) return;
                      deleteWorkspaceTplMut.mutate(t.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </EnterpriseSlideOver>
    </div>
  );
}

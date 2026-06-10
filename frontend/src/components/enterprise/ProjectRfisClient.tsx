"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Eye,
  FileText,
  Flag,
  Hash,
  LayoutGrid,
  Lock,
  MessageSquareQuote,
  Plus,
  RotateCcw,
  SortAsc,
  Users,
} from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  createProjectRfi,
  fetchIssuesForProject,
  fetchProject,
  fetchProjectRfis,
  fetchProjectTeam,
  fetchProjects,
  fetchWorkspaceMembers,
  ProRequiredError,
  type RfiRow,
} from "@/lib/api-client";
import {
  priorityBadgeClassLight,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_SELECT,
  OM_PAGE_CLASS,
} from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import type { CloudFile, Project } from "@/types/projects";
import { folderPathLabel } from "@/lib/folderPathLabel";

type StatusFilter = "ALL" | "OPEN" | "IN_REVIEW" | "ANSWERED" | "CLOSED" | "OVERDUE";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
type SortKey = "newest" | "file" | "status";

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

function isOverdueRow(r: RfiRow, nowMs: number): boolean {
  if (!r.dueDate) return false;
  const st = normStatus(r.status);
  if (st === "ANSWERED" || st === "CLOSED") return false;
  return new Date(r.dueDate).getTime() < nowMs;
}

/** User ids designated to respond (assignees + legacy single assignee). */
function rfiAssigneeUserIds(r: RfiRow): string[] {
  const ids = new Set<string>();
  if (r.assignedToUserId) ids.add(r.assignedToUserId);
  if (r.assignedTo?.id) ids.add(r.assignedTo.id);
  for (const a of r.assignees ?? []) {
    if (a.id) ids.add(a.id);
  }
  return [...ids];
}

function rfiIsUnassigned(r: RfiRow): boolean {
  return rfiAssigneeUserIds(r).length === 0;
}

function rfiHasAssigneeUser(r: RfiRow, userId: string): boolean {
  return rfiAssigneeUserIds(r).includes(userId);
}

const PRI_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const OVERDUE_BADGE =
  "rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-semantic-danger-text)]";

const FILTER_DEFS: { key: StatusFilter; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_REVIEW", label: "In review", Icon: Eye },
  { key: "ANSWERED", label: "Answered", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
  { key: "OVERDUE", label: "Overdue", Icon: AlertTriangle },
];

function rfiRespondersDisplay(r: RfiRow): string {
  const names = (r.assignees ?? []).map((a) => a.name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return r.assignedTo?.name ?? "—";
}

type SheetPickRow = {
  file: CloudFile;
  version: { id: string; version: number };
  group: string;
};

/** All sheet revisions for the RFI drawing picker, sorted by folder path then name. */
function sheetRowsForProject(project: Project): SheetPickRow[] {
  const out: SheetPickRow[] = [];
  for (const f of project.files) {
    const group = folderPathLabel(project.folders, f.folderId);
    for (const v of f.versions) {
      out.push({ file: f, version: { id: v.id, version: v.version }, group });
    }
  }
  return out.sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    if (g !== 0) return g;
    const n = a.file.name.localeCompare(b.file.name);
    if (n !== 0) return n;
    return b.version.version - a.version.version;
  });
}

function groupSheetRows(rows: SheetPickRow[]): { group: string; items: SheetPickRow[] }[] {
  const map = new Map<string, SheetPickRow[]>();
  for (const r of rows) {
    const arr = map.get(r.group) ?? [];
    arr.push(r);
    map.set(r.group, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({ group, items }));
}

function RfiEmptyState({ noRows }: { noRows: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <MessageSquareQuote
          className="h-5 w-5 text-[var(--enterprise-primary)]"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          {noRows ? "No RFIs yet" : "No matches"}
        </p>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          {noRows
            ? "Create your first RFI to capture questions and official responses."
            : "Try another filter or reset to show all RFIs."}
        </p>
      </div>
    </div>
  );
}

export function ProjectRfisClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const nowMs = useTickNowMs();
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [slideOpen, setSlideOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [fromDiscipline, setFromDiscipline] = useState("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [dueYmd, setDueYmd] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [risk, setRisk] = useState<"" | "low" | "med" | "high">("");
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [sheetPick, setSheetPick] = useState(""); // "fileId|fileVersionId"
  const [pageNum, setPageNum] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
    enabled: Boolean(projectId),
  });

  const { data: projectMeta } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
  });
  const workspaceId = projectMeta?.workspaceId;

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const members = membersRes?.members ?? [];

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && slideOpen),
  });

  const { data: issues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && slideOpen && isPro),
  });

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && slideOpen && isPro),
  });

  const project = projects.find((p) => p.id === projectId);
  const sheetGrouped = useMemo(
    () => (project ? groupSheetRows(sheetRowsForProject(project)) : []),
    [project],
  );

  const assignablePickRows = useMemo(() => {
    return (team?.members ?? [])
      .filter((m) => m.access === "full" || m.access === "project")
      .map((m) => ({ userId: m.userId, name: m.name, email: m.email }));
  }, [team]);

  const filtered = useMemo(() => {
    let list: RfiRow[] =
      filter === "ALL"
        ? rows
        : filter === "OVERDUE"
          ? rows.filter((r) => isOverdueRow(r, nowMs))
          : rows.filter((r) => normStatus(r.status) === filter);
    if (assigneeFilter === "UNASSIGNED") {
      list = list.filter((r) => rfiIsUnassigned(r));
    } else if (assigneeFilter !== "ALL") {
      list = list.filter((r) => rfiHasAssigneeUser(r, assigneeFilter));
    }
    if (sort === "newest") {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "file") {
      list = [...list].sort((a, b) =>
        (a.file?.name ?? "").localeCompare(b.file?.name ?? "", undefined, { sensitivity: "base" }),
      );
    } else if (sort === "status") {
      list = [...list].sort((a, b) => normStatus(a.status).localeCompare(normStatus(b.status)));
    }
    return list;
  }, [rows, filter, nowMs, assigneeFilter, sort]);

  const filtersActive = filter !== "ALL" || assigneeFilter !== "ALL" || sort !== "newest";

  const clearFilters = () => {
    setFilter("ALL");
    setAssigneeFilter("ALL");
    setSort("newest");
  };

  function resetModal() {
    setTitle("");
    setQuestion("");
    setFromDiscipline("");
    setAssignUserIds([]);
    setDueYmd("");
    setPriority("MEDIUM");
    setRisk("");
    setIssueIds([]);
    setSheetPick("");
    setPageNum("");
    setMsg(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      let fileId: string | undefined;
      let fileVersionId: string | undefined;
      if (issueIds.length === 0 && sheetPick.includes("|")) {
        const [f, v] = sheetPick.split("|");
        if (f && v) {
          fileId = f;
          fileVersionId = v;
        }
      }
      const pn = pageNum.trim() ? parseInt(pageNum, 10) : undefined;
      return createProjectRfi(projectId, {
        title: title.trim(),
        description: question.trim(),
        fromDiscipline: fromDiscipline.trim() || undefined,
        assigneeUserIds: assignUserIds.length > 0 ? assignUserIds : undefined,
        dueDate: dueYmd.trim() ? dueYmd.trim() : null,
        priority,
        risk: risk === "" ? null : risk,
        issueIds: issueIds.length > 0 ? issueIds : undefined,
        fileId,
        fileVersionId,
        pageNumber: Number.isFinite(pn) ? pn : undefined,
      });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      setSlideOpen(false);
      resetModal();
      router.push(`/projects/${projectId}/rfi/${data.id}`);
    },
    onError: (e: Error) => {
      if (e instanceof ProRequiredError) setMsg("Pro subscription required.");
      else setMsg(e.message);
    },
  });

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }

  const fieldClass = MOBILE_FIELD_INPUT;
  const labelClass = MOBILE_FIELD_LABEL;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={MessageSquareQuote}
        title="RFIs"
        description={
          !isPending
            ? rows.length === 0
              ? "No requests for information in this project yet."
              : `${rows.length} RFI${rows.length === 1 ? "" : "s"} · formal Q&A with review and recorded answers`
            : "Formal requests for information — send for review, capture the official response, then close."
        }
        action={
          isPro ? (
            <EnterpriseButton
              size="sm"
              disabled={ctxLoading || !isPro}
              onClick={() => {
                resetModal();
                setSlideOpen(true);
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New RFI
            </EnterpriseButton>
          ) : null
        }
      />

      {!isPro ? (
        <div className="enterprise-alert-info flex items-start gap-3 px-4 py-3 shadow-[var(--enterprise-shadow-xs)]">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]"
            aria-hidden
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <p className="text-sm leading-relaxed">
            Pro subscription required to create and manage RFIs.
          </p>
        </div>
      ) : null}

      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="mobile-chip-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Filter by status"
          >
            {FILTER_DEFS.map((f) => {
              const TabIcon = f.Icon;
              const selected = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                    selected ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
                  }`}
                  style={selected ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
                >
                  <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {f.label}
                </button>
              );
            })}
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
            >
              <RotateCcw className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
              Reset
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[9rem]">
            <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Assignee
            </span>
            <select
              id="rfis-assignee-filter"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
              className={OM_COMPACT_SELECT}
            >
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email || m.userId}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[9rem]">
            <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
              <SortAsc className="h-3.5 w-3.5" aria-hidden />
              Sort
            </span>
            <select
              id="rfis-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={OM_COMPACT_SELECT}
            >
              <option value="newest">Newest first</option>
              <option value="file">File name</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </div>

      {!isPending && rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--enterprise-text-muted)]">
          <p>
            Showing{" "}
            <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
              {filtered.length}
            </span>
            {filtered.length !== rows.length ? (
              <>
                {" "}
                of{" "}
                <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {rows.length}
                </span>
              </>
            ) : null}{" "}
            {filtered.length === 1 ? "RFI" : "RFIs"}
            {filtersActive ? (
              <span className="text-[var(--enterprise-text-muted)]"> (filtered)</span>
            ) : null}
          </p>
        </div>
      ) : null}

      <EnterpriseSlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          resetModal();
        }}
        form={{
          onSubmit: (e) => {
            e.preventDefault();
            if (!title.trim() || !question.trim()) return;
            createMut.mutate();
          },
        }}
        ariaLabelledBy="rfi-create-title"
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),520px)]"
        bodyClassName="px-5 py-5"
        header={
          <div className="flex items-start gap-3 pr-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
              <MessageSquareQuote
                className="h-5 w-5 text-[var(--enterprise-primary)]"
                strokeWidth={1.75}
              />
            </div>
            <div className="min-w-0">
              <h2
                id="rfi-create-title"
                className="text-lg font-bold tracking-tight text-[var(--enterprise-text)]"
              >
                New RFI
              </h2>
              <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
                Required: title and question. Assign someone before you send for review from the
                detail page.
              </p>
            </div>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setSlideOpen(false);
                resetModal();
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
            >
              {createMut.isPending ? "Creating…" : "Create RFI"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className={MOBILE_FORM_SECTION}>
            <div>
              <label htmlFor="rfi-title" className={labelClass}>
                Title *
              </label>
              <input
                id="rfi-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
                required
                placeholder="Wall thickness clarification"
              />
            </div>
            <div>
              <label htmlFor="rfi-question" className={labelClass}>
                Question *
              </label>
              <textarea
                id="rfi-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                required
                className={MOBILE_FIELD_TEXTAREA}
                placeholder="Describe what needs an official answer…"
              />
            </div>
          </div>
          <div className={`${MOBILE_FORM_SECTION} grid gap-4`}>
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                From discipline
              </label>
              <input
                value={fromDiscipline}
                onChange={(e) => setFromDiscipline(e.target.value)}
                className={fieldClass}
                placeholder="GC, Structural, MEP…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Responders (optional)
              </label>
              <div className="mt-1">
                {assignablePickRows.length === 0 ? (
                  <p className="text-xs text-[var(--enterprise-text-muted)]">No members yet.</p>
                ) : (
                  <EnterpriseMemberMultiPicker
                    members={assignablePickRows}
                    value={assignUserIds}
                    onChange={setAssignUserIds}
                    disabled={createMut.isPending}
                    emptyMessage="No one matches that search."
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                Search and add people. Any selected person can receive the review and submit the
                answer. Leave empty to assign later.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Due date
              </label>
              <input
                type="date"
                value={dueYmd}
                onChange={(e) => setDueYmd(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className={fieldClass}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Risk
              </label>
              <select
                value={risk}
                onChange={(e) => setRisk(e.target.value as typeof risk)}
                className={fieldClass}
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Related issues (optional)
            </label>
            <div className="mt-1 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2">
              {issues.length === 0 ? (
                <p className="text-xs text-[var(--enterprise-text-muted)]">
                  No issues in this project yet.
                </p>
              ) : (
                issues.map((i) => (
                  <label
                    key={i.id}
                    className="flex cursor-pointer items-start gap-2 text-sm text-[var(--enterprise-text)]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={issueIds.includes(i.id)}
                      onChange={() => {
                        setIssueIds((prev) =>
                          prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id],
                        );
                        setSheetPick("");
                      }}
                    />
                    <span className="leading-snug">{i.title}</span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              {issueIds.length > 0
                ? "Sheet defaults from the first selected issue unless you link a drawing below."
                : "Select one or more site issues, or leave empty and link a drawing below."}
            </p>
          </div>
          {issueIds.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Link to drawing (optional)
                </label>
                <select
                  value={sheetPick}
                  onChange={(e) => setSheetPick(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">— Select sheet & revision —</option>
                  {sheetGrouped.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map(({ file, version }) => (
                        <option key={`${file.id}|${version.id}`} value={`${file.id}|${version.id}`}>
                          {file.name} · v{version.version}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {project && sheetGrouped.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                    No drawings in this project yet. Add PDFs under Files, then link a sheet here.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Page (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={pageNum}
                  onChange={(e) => setPageNum(e.target.value)}
                  className={fieldClass}
                  placeholder="1"
                />
              </div>
            </div>
          ) : null}
          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
        </div>
      </EnterpriseSlideOver>

      {isPending ? (
        <div className="enterprise-card py-16">
          <EnterpriseLoadingState
            variant="minimal"
            message="Loading RFIs…"
            label="Loading project RFIs"
          />
        </div>
      ) : (
        <PullToRefresh
          onRefresh={async () => {
            await qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
          }}
        >
          <>
            <ul className="space-y-3 md:hidden" aria-label="RFI list">
              {filtered.length === 0 ? (
                <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
                  <RfiEmptyState noRows={rows.length === 0} />
                </li>
              ) : (
                filtered.map((r) => {
                  const overdue = isOverdueRow(r, nowMs);
                  const pri = (r.priority || "MEDIUM").toUpperCase();
                  const stLabel =
                    RFI_STATUS_LABEL[normStatus(r.status)] ??
                    normStatus(r.status).replace(/_/g, " ");
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/projects/${projectId}/rfi/${r.id}`}
                        className="block touch-manipulation rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:shadow-[var(--enterprise-shadow-sm)] active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="shrink-0 rounded-md bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
                            #{String(r.rfiNumber).padStart(3, "0")}
                          </span>
                          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${rfiStatusBadgeClass(normStatus(r.status))}`}
                            >
                              {stLabel}
                            </span>
                            {overdue ? <span className={OVERDUE_BADGE}>Overdue</span> : null}
                          </span>
                        </div>
                        <div className="mt-2 flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-[var(--enterprise-text)]">
                            {r.title}
                          </p>
                          <ChevronRight
                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)]/45"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </div>
                        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--enterprise-text-muted)] sm:grid-cols-3">
                          <div className="flex gap-1.5">
                            <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">
                              Assigned
                            </dt>
                            <dd className="min-w-0 truncate">{rfiRespondersDisplay(r)}</dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">
                              Due
                            </dt>
                            <dd className="tabular-nums">{formatDate(r.dueDate)}</dd>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">
                              Priority
                            </dt>
                            <dd>
                              <span
                                className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClassLight(pri)}`}
                              >
                                {PRI_LABEL[pri] ?? pri}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="enterprise-card hidden overflow-hidden p-0 md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm text-[var(--enterprise-text)]">
                  <thead>
                    <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      <th className="w-16 px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} aria-hidden />
                          #
                        </span>
                      </th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText
                            className="h-3.5 w-3.5 opacity-70"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          Title
                        </span>
                      </th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Activity
                            className="h-3.5 w-3.5 opacity-70"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          Status
                        </span>
                      </th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Users
                            className="h-3.5 w-3.5 opacity-70"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          Assigned
                        </span>
                      </th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar
                            className="h-3.5 w-3.5 opacity-70"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          Due
                        </span>
                      </th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Flag className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} aria-hidden />
                          Priority
                        </span>
                      </th>
                      <th className="w-12 px-2 py-3" aria-hidden>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <RfiEmptyState noRows={rows.length === 0} />
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => {
                        const overdue = isOverdueRow(r, nowMs);
                        const pri = (r.priority || "MEDIUM").toUpperCase();
                        return (
                          <tr
                            key={r.id}
                            className="cursor-pointer border-b border-[var(--enterprise-border)]/80 transition last:border-0 hover:bg-[var(--enterprise-hover-surface)]"
                            onClick={() => router.push(`/projects/${projectId}/rfi/${r.id}`)}
                          >
                            <td className="px-4 py-3 tabular-nums text-[var(--enterprise-text-muted)]">
                              {String(r.rfiNumber).padStart(3, "0")}
                            </td>
                            <td className="max-w-[min(280px,32vw)] px-4 py-3 font-medium text-[var(--enterprise-text)]">
                              <span className="line-clamp-2">{r.title}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${rfiStatusBadgeClass(normStatus(r.status))}`}
                                >
                                  {RFI_STATUS_LABEL[normStatus(r.status)] ??
                                    normStatus(r.status).replace(/_/g, " ")}
                                </span>
                                {overdue ? <span className={OVERDUE_BADGE}>Overdue</span> : null}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">
                              {rfiRespondersDisplay(r)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-[var(--enterprise-text-muted)]">
                              {formatDate(r.dueDate)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClassLight(pri)}`}
                              >
                                {PRI_LABEL[pri] ?? pri}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-[var(--enterprise-text-muted)]/50">
                              <ChevronRight
                                className="mx-auto h-4 w-4"
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        </PullToRefresh>
      )}
    </div>
  );
}

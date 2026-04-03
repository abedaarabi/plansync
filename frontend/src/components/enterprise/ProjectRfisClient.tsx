"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareQuote, Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  createProjectRfi,
  fetchIssuesForProject,
  fetchProjectRfis,
  fetchProjectTeam,
  fetchProjects,
  ProRequiredError,
  type RfiRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useTickNowMs } from "@/lib/useTickNowMs";
import type { CloudFile, Folder, Project } from "@/types/projects";

type StatusFilter = "ALL" | "OPEN" | "IN_REVIEW" | "ANSWERED" | "CLOSED" | "OVERDUE";

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

function isOverdueRow(r: RfiRow, nowMs: number): boolean {
  if (!r.dueDate) return false;
  const st = normStatus(r.status);
  if (st === "ANSWERED" || st === "CLOSED") return false;
  return new Date(r.dueDate).getTime() < nowMs;
}

const STATUS_DOT: Record<string, string> = {
  OPEN: "bg-blue-500",
  IN_REVIEW: "bg-amber-400",
  ANSWERED: "bg-emerald-500",
  CLOSED: "bg-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  ANSWERED: "Answered",
  CLOSED: "Closed",
};

const PRI_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PRI_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-50 text-amber-800",
  HIGH: "bg-red-50 text-red-700",
};

function rfiRespondersDisplay(r: RfiRow): string {
  const names = (r.assignees ?? []).map((a) => a.name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return r.assignedTo?.name ?? "—";
}

function folderPathLabel(folders: Folder[], folderId: string | null): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segments: string[] = [];
  let cur: string | null = folderId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const row = byId.get(cur);
    if (!row) break;
    segments.unshift(row.name);
    cur = row.parentId;
  }
  return segments.length ? segments.join(" / ") : "Project root";
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

export function ProjectRfisClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const nowMs = useTickNowMs();
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = primary?.workspace.subscriptionStatus === "active";

  const [filter, setFilter] = useState<StatusFilter>("ALL");
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

  const stats = useMemo(() => {
    let open = 0;
    let inReview = 0;
    let answered = 0;
    let closed = 0;
    let overdue = 0;
    for (const r of rows) {
      const s = normStatus(r.status);
      if (s === "OPEN") open += 1;
      if (s === "IN_REVIEW") inReview += 1;
      if (s === "ANSWERED") answered += 1;
      if (s === "CLOSED") closed += 1;
      if (isOverdueRow(r, nowMs)) overdue += 1;
    }
    return { open, inReview, answered, closed, overdue };
  }, [rows, nowMs]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    if (filter === "OVERDUE") return rows.filter((r) => isOverdueRow(r, nowMs));
    return rows.filter((r) => normStatus(r.status) === filter);
  }, [rows, filter, nowMs]);

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

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "IN_REVIEW", label: "In review" },
    { key: "ANSWERED", label: "Answered" },
    { key: "CLOSED", label: "Closed" },
    { key: "OVERDUE", label: "Overdue" },
  ];

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              RFIs
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              Formal requests for information — send for review, capture the official response, then
              close.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetModal();
              setSlideOpen(true);
            }}
            disabled={ctxLoading || !isPro}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 self-stretch rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50 sm:h-10 sm:w-auto sm:min-h-0 sm:self-start sm:rounded-lg sm:px-3 sm:text-xs"
          >
            <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.75} />
            New RFI
          </button>
        </header>

        {!isPro ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Pro subscription required to create and manage RFIs.
          </p>
        ) : null}

        <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-[var(--enterprise-border)]/70 bg-[var(--enterprise-bg)]/90 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--enterprise-bg)]/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-9 items-center rounded-lg border border-blue-200/80 bg-blue-50/90 px-3 py-1.5 text-xs font-medium text-blue-900">
              {stats.open} Open
            </span>
            <span className="inline-flex min-h-9 items-center rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-950">
              {stats.inReview} In review
            </span>
            <span className="inline-flex min-h-9 items-center rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-900">
              {stats.answered} Answered
            </span>
            <span className="inline-flex min-h-9 items-center rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-1.5 text-xs font-medium text-red-900">
              {stats.overdue} Overdue
            </span>
          </div>

          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Filter by status"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-lg px-3.5 py-2.5 text-xs font-medium transition sm:py-2 ${
                  filter === f.key
                    ? "bg-[var(--enterprise-primary)] text-white shadow-sm"
                    : "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

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
          panelMaxWidthClass="max-w-[min(100vw-16px,520px)]"
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
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
                required
                placeholder="Wall thickness clarification"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Question *
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                required
                className={fieldClass}
                placeholder="Describe what needs an official answer…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
                          <option
                            key={`${file.id}|${version.id}`}
                            value={`${file.id}|${version.id}`}
                          >
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
          <div className="py-12">
            <EnterpriseLoadingState
              variant="minimal"
              message="Loading RFIs…"
              label="Loading project RFIs"
            />
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden" aria-label="RFI list">
              {filtered.length === 0 ? (
                <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)]">
                  {rows.length === 0
                    ? "No RFIs yet. Create one to get started."
                    : "No RFIs match this filter."}
                </li>
              ) : (
                filtered.map((r) => {
                  const overdue = isOverdueRow(r, nowMs);
                  const pri = (r.priority || "MEDIUM").toUpperCase();
                  const stLabel =
                    STATUS_LABEL[normStatus(r.status)] ?? normStatus(r.status).replace(/_/g, " ");
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
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-2 py-1">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[normStatus(r.status)] ?? "bg-slate-400"}`}
                              />
                              <span className="text-xs font-medium text-[var(--enterprise-text)]">
                                {stLabel}
                              </span>
                            </span>
                            {overdue ? (
                              <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                                Overdue
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <p className="mt-2 text-base font-semibold leading-snug text-[var(--enterprise-text)]">
                          {r.title}
                        </p>
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
                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PRI_BADGE[pri] ?? "bg-slate-100 text-slate-600"}`}
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
                <table className="w-full min-w-[720px] text-left text-sm text-[var(--enterprise-text)]">
                  <thead>
                    <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      <th className="w-16 px-4 py-3">#</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-14 text-center text-sm text-[var(--enterprise-text-muted)]"
                        >
                          {rows.length === 0
                            ? "No RFIs yet. Create one to get started."
                            : "No RFIs match this filter."}
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
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-0.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${STATUS_DOT[normStatus(r.status)] ?? "bg-slate-400"}`}
                                  />
                                  <span className="text-xs font-medium text-[var(--enterprise-text)]">
                                    {STATUS_LABEL[normStatus(r.status)] ??
                                      normStatus(r.status).replace(/_/g, " ")}
                                  </span>
                                </span>
                                {overdue ? (
                                  <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                                    Overdue
                                  </span>
                                ) : null}
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
                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PRI_BADGE[pri] ?? "bg-slate-100 text-slate-600"}`}
                              >
                                {PRI_LABEL[pri] ?? pri}
                              </span>
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
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
  Search,
  Users,
} from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { RfiCreateSlideOver } from "@/components/enterprise/RfiCreateSlideOver";
import { RfiEditSlideOver } from "@/components/enterprise/RfiEditSlideOver";
import { RfisOverview } from "@/components/enterprise/RfisOverview";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { fetchProjectRfis, type RfiRow } from "@/lib/api-client";
import {
  priorityBadgeClassLight,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import {
  AssigneeFilterSelect,
  SortSelect,
  StatusFilterChips,
  useProjectWorkspaceMembers,
  type SortSelectOption,
} from "@/components/enterprise/issueListControls";
import { qk } from "@/lib/queryKeys";
import { isRfiOverdue, rfiBallInCourt, type RfisOverviewFilter } from "@/lib/rfisOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

type StatusFilter = "ALL" | "OPEN" | "IN_REVIEW" | "ANSWERED" | "CLOSED" | "OVERDUE";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
type SortKey = "newest" | "file" | "status";

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
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

const RFI_SORT_OPTIONS: SortSelectOption<SortKey>[] = [
  { value: "newest", label: "Newest first" },
  { value: "file", label: "File name" },
  { value: "status", label: "Status" },
];

function rfiRespondersDisplay(r: RfiRow): string {
  const names = (r.assignees ?? []).map((a) => a.name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return r.assignedTo?.name ?? "—";
}

function rfiNumberLabel(n: number): string {
  return `RFI-${String(n).padStart(3, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

// fallow-ignore-next-line complexity
export function ProjectRfisClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rfiDeepLink = searchParams.get("rfi")?.trim() || null;
  const nowMs = useTickNowMs();
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRfi, setEditRfi] = useState<RfiRow | null>(null);
  const openedRfiRef = useRef<string | null>(null);

  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
    enabled: Boolean(projectId),
  });

  const { members } = useProjectWorkspaceMembers(projectId);

  useEffect(() => {
    if (!rfiDeepLink || rows.length === 0) return;
    if (openedRfiRef.current === rfiDeepLink) return;
    const match = rows.find((r) => r.id === rfiDeepLink);
    if (!match) return;
    openedRfiRef.current = rfiDeepLink;
    setEditRfi(match);
  }, [rfiDeepLink, rows]);

  useEffect(() => {
    if (!editRfi) return;
    const fresh = rows.find((r) => r.id === editRfi.id);
    if (fresh && fresh.updatedAt !== editRfi.updatedAt) setEditRfi(fresh);
  }, [rows, editRfi]);

  const overviewFilter: RfisOverviewFilter =
    assigneeFilter === "UNASSIGNED" ? "UNASSIGNED" : filter;

  function handleOverviewFilter(key: RfisOverviewFilter) {
    if (key === "UNASSIGNED") {
      setAssigneeFilter("UNASSIGNED");
      setFilter("ALL");
      return;
    }
    setFilter(key);
    if (assigneeFilter === "UNASSIGNED") setAssigneeFilter("ALL");
  }

  const filtered = useMemo(() => {
    let list: RfiRow[] =
      filter === "ALL"
        ? rows
        : filter === "OVERDUE"
          ? rows.filter((r) => isRfiOverdue(r, nowMs))
          : rows.filter((r) => normStatus(r.status) === filter);
    if (assigneeFilter === "UNASSIGNED") {
      list = list.filter((r) => rfiIsUnassigned(r));
    } else if (assigneeFilter !== "ALL") {
      list = list.filter((r) => rfiHasAssigneeUser(r, assigneeFilter));
    }
    const q = searchInput.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.title,
          r.description,
          rfiNumberLabel(r.rfiNumber),
          String(r.rfiNumber),
          rfiRespondersDisplay(r),
          rfiBallInCourt(r),
          r.file?.name,
          r.fromDiscipline,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
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
  }, [rows, filter, nowMs, assigneeFilter, sort, searchInput]);

  const filtersActive =
    filter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    sort !== "newest" ||
    Boolean(searchInput.trim());

  const clearFilters = () => {
    setFilter("ALL");
    setAssigneeFilter("ALL");
    setSort("newest");
    setSearchInput("");
  };

  function openEdit(r: RfiRow) {
    setEditRfi(r);
    const p = new URLSearchParams(searchParams.toString());
    p.set("rfi", r.id);
    router.replace(`/projects/${projectId}/rfi?${p.toString()}`, { scroll: false });
  }

  function closeEdit() {
    setEditRfi(null);
    openedRfiRef.current = null;
    const p = new URLSearchParams(searchParams.toString());
    if (!p.has("rfi")) return;
    p.delete("rfi");
    const qs = p.toString();
    router.replace(qs ? `/projects/${projectId}/rfi?${qs}` : `/projects/${projectId}/rfi`, {
      scroll: false,
    });
  }

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
              onClick={() => setCreateOpen(true)}
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

      {!isPending && rows.length > 0 ? (
        <RfisOverview rows={rows} filter={overviewFilter} onFilterChange={handleOverviewFilter} />
      ) : null}

      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
        <StatusFilterChips
          defs={FILTER_DEFS}
          value={filter}
          onChange={(key) => {
            setFilter(key);
            if (assigneeFilter === "UNASSIGNED") setAssigneeFilter("ALL");
          }}
          filtersActive={filtersActive}
          onReset={clearFilters}
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[min(100%,220px)] flex-1 items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
            <label className="sr-only" htmlFor="rfis-search">
              Search RFIs
            </label>
            <input
              id="rfis-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, number, responders…"
              className="min-h-8 w-full bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
            />
          </div>
          <AssigneeFilterSelect
            id="rfis-assignee-filter"
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            members={members}
          />
          <SortSelect id="rfis-sort" value={sort} onChange={setSort} options={RFI_SORT_OPTIONS} />
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

      <RfiCreateSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        isPro={isPro}
        workspaceId={wid}
        onCreated={(data) => {
          setCreateOpen(false);
          openEdit(data);
        }}
      />

      <RfiEditSlideOver
        open={Boolean(editRfi)}
        onClose={closeEdit}
        projectId={projectId}
        rfi={editRfi}
      />

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
                <li>
                  <OmEmptyState
                    icon={MessageSquareQuote}
                    title={rows.length === 0 ? "No RFIs yet" : "No matches"}
                    description={
                      rows.length === 0
                        ? "Create your first RFI to capture questions and official responses."
                        : "Try another filter or reset to show all RFIs."
                    }
                    action={
                      rows.length === 0 && isPro ? (
                        <EnterpriseButton size="sm" onClick={() => setCreateOpen(true)}>
                          <Plus className="h-4 w-4" strokeWidth={1.75} />
                          New RFI
                        </EnterpriseButton>
                      ) : null
                    }
                  />
                </li>
              ) : (
                filtered.map((r) => {
                  const overdue = isRfiOverdue(r, nowMs);
                  const pri = (r.priority || "MEDIUM").toUpperCase();
                  const stLabel =
                    RFI_STATUS_LABEL[normStatus(r.status)] ??
                    normStatus(r.status).replace(/_/g, " ");
                  const active = editRfi?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className={`w-full rounded-xl border bg-[var(--enterprise-surface)] p-4 text-left shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:shadow-[var(--enterprise-shadow-sm)] active:scale-[0.99] ${
                          active
                            ? "border-[var(--enterprise-primary)]/35 ring-2 ring-[var(--enterprise-primary)]/15"
                            : "border-[var(--enterprise-border)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex shrink-0 rounded-md bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
                              {rfiNumberLabel(r.rfiNumber)}
                            </span>
                            <span className="mt-2 inline-flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${rfiStatusBadgeClass(normStatus(r.status))}`}
                              >
                                {stLabel}
                              </span>
                              {overdue ? <span className={OVERDUE_BADGE}>Overdue</span> : null}
                            </span>
                            <p className="mt-2 text-base font-semibold leading-snug text-[var(--enterprise-text)]">
                              {r.title}
                            </p>
                          </div>
                          <ChevronRight
                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)]/45"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </div>
                        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--enterprise-text-muted)] sm:grid-cols-2">
                          <div className="flex gap-1.5">
                            <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">
                              Ball in court
                            </dt>
                            <dd className="min-w-0 truncate">{rfiBallInCourt(r)}</dd>
                          </div>
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
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="enterprise-card hidden overflow-hidden p-0 md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm text-[var(--enterprise-text)]">
                  <thead>
                    <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      <th className="w-24 px-4 py-3">
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
                          <CircleDot
                            className="h-3.5 w-3.5 opacity-70"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          Ball in court
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
                      <th className="w-28 px-2 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4">
                          <OmEmptyState
                            icon={MessageSquareQuote}
                            title={rows.length === 0 ? "No RFIs yet" : "No matches"}
                            description={
                              rows.length === 0
                                ? "Create your first RFI to capture questions and official responses."
                                : "Try another filter or reset to show all RFIs."
                            }
                            action={
                              rows.length === 0 && isPro ? (
                                <EnterpriseButton size="sm" onClick={() => setCreateOpen(true)}>
                                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                                  New RFI
                                </EnterpriseButton>
                              ) : null
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => {
                        const overdue = isRfiOverdue(r, nowMs);
                        const pri = (r.priority || "MEDIUM").toUpperCase();
                        const active = editRfi?.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => openEdit(r)}
                            className={`cursor-pointer border-b border-[var(--enterprise-border)]/80 transition last:border-0 hover:bg-[var(--enterprise-hover-surface)] ${
                              active
                                ? "border-l-4 border-l-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/8"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-mono tabular-nums text-[var(--enterprise-text-muted)]">
                              {rfiNumberLabel(r.rfiNumber)}
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
                              {rfiBallInCourt(r)}
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

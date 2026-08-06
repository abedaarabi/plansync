"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Columns3,
  LayoutList,
  Library,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { WorkOrderCard } from "@/components/enterprise/WorkOrderCard";
import { WorkOrderCompleteSlideOver } from "@/components/enterprise/WorkOrderCompleteSlideOver";
import { WorkOrderCreateSlideOver } from "@/components/enterprise/WorkOrderCreateSlideOver";
import { WorkOrderEditSlideOver } from "@/components/enterprise/WorkOrderEditSlideOver";
import { WorkOrderMobileActionsSheet } from "@/components/enterprise/WorkOrderMobileActionsSheet";
import { WorkOrdersBoard } from "@/components/enterprise/WorkOrdersBoard";
import { WorkOrdersOverview } from "@/components/enterprise/WorkOrdersOverview";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  deleteOmWorkspaceWorkOrderTemplate,
  fetchIssuesForProject,
  fetchOmWorkspaceWorkOrderTemplates,
  fetchProjectSession,
  fetchWorkspaceMembers,
  patchIssue,
  postOmWorkspaceWorkOrderTemplate,
  postWorkOrderAiTroubleshoot,
  postWorkOrderVendorLink,
  type IssueRow,
  type WorkspaceWorkOrderTemplateRow,
  ProRequiredError,
} from "@/lib/api-client";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import { OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { useTickNowMs } from "@/lib/useTickNowMs";
import {
  computeWorkOrdersOverview,
  filterWorkOrders,
  type WorkOrdersOverviewFilter,
} from "@/lib/workOrdersOverviewStats";

type ChipKey = "all" | "mine" | "dueToday" | "overdue";
type ViewMode = "list" | "board";

const LIST_FILTERS: { key: ChipKey; label: string; icon: typeof UserRound }[] = [
  { key: "all", label: "All", icon: LayoutList },
  { key: "mine", label: "Mine", icon: UserRound },
  { key: "dueToday", label: "Due today", icon: Calendar },
  { key: "overdue", label: "Overdue", icon: AlertTriangle },
];

type Props = { projectId: string };

function chipToFilter(key: ChipKey): WorkOrdersOverviewFilter {
  if (key === "mine") return "MINE";
  if (key === "dueToday") return "DUE_TODAY";
  if (key === "overdue") return "OVERDUE";
  return "ACTIVE";
}

function filterToChip(filter: WorkOrdersOverviewFilter): ChipKey {
  if (filter === "MINE") return "mine";
  if (filter === "DUE_TODAY") return "dueToday";
  if (filter === "OVERDUE") return "overdue";
  return "all";
}

function filterToStatusSelect(filter: WorkOrdersOverviewFilter): string {
  if (
    filter === "OPEN" ||
    filter === "IN_PROGRESS" ||
    filter === "RESOLVED" ||
    filter === "CLOSED" ||
    filter === "ALL"
  ) {
    return filter;
  }
  if (filter === "ACTIVE") return "ACTIVE";
  return "ACTIVE";
}

// fallow-ignore-next-line complexity
export function WorkOrdersClient({ projectId }: Props) {
  const searchParams = useSearchParams();
  const assetIdFilter = searchParams.get("assetId") ?? undefined;
  const createDeepLink = searchParams.get("create") === "1";
  const woDeepLink = searchParams.get("wo") ?? undefined;
  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const currentUserId = me?.user.id;
  const workspaceId = primary?.workspace.id;
  const nowMs = useTickNowMs();

  const [overviewFilter, setOverviewFilter] = useState<WorkOrdersOverviewFilter>("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [editIssue, setEditIssue] = useState<IssueRow | null>(null);
  const [completeIssue, setCompleteIssue] = useState<IssueRow | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [vendorLinkBusyId, setVendorLinkBusyId] = useState<string | null>(null);
  const [highlightWoId, setHighlightWoId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [actionsWo, setActionsWo] = useState<IssueRow | null>(null);
  const [templateLibOpen, setTemplateLibOpen] = useState(false);
  const openedWoRef = useRef<string | null>(null);
  const openedCreateRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim().toLowerCase()), 200);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const members = membersRes?.members ?? [];

  const {
    data: rows = [],
    isPending,
    error,
  } = useQuery({
    queryKey: qk.workOrders(projectId, assetIdFilter ?? "all"),
    queryFn: () =>
      fetchIssuesForProject(projectId, {
        issueKind: "WORK_ORDER",
        assetId: assetIdFilter,
      }),
    enabled: Boolean(session?.settings.modules.issues),
  });

  useEffect(() => {
    if (!woDeepLink || rows.length === 0) return;
    if (openedWoRef.current === woDeepLink) return;
    const match = rows.find((r) => r.id === woDeepLink);
    if (!match) return;
    openedWoRef.current = woDeepLink;
    setOverviewFilter("ALL");
    setEditIssue(match);
    setHighlightWoId(match.id);
  }, [woDeepLink, rows]);

  useEffect(() => {
    if (!createDeepLink || !assetIdFilter) return;
    if (openedCreateRef.current) return;
    openedCreateRef.current = true;
    setCreateOpen(true);
  }, [createDeepLink, assetIdFilter]);

  const overviewStats = useMemo(
    () => computeWorkOrdersOverview(rows, nowMs, currentUserId),
    [rows, nowMs, currentUserId],
  );

  const filtered = useMemo(() => {
    const base = filterWorkOrders(rows, overviewFilter, nowMs, currentUserId);
    if (!debouncedQ) return base;
    return base.filter((wo) => {
      const hay = [
        wo.title,
        wo.description,
        wo.location,
        wo.asset?.tag,
        wo.asset?.name,
        wo.assignee?.name,
        wo.assignee?.email,
        wo.vendor?.name,
        wo.workOrderType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(debouncedQ);
    });
  }, [rows, overviewFilter, nowMs, currentUserId, debouncedQ]);

  const filtersActive =
    overviewFilter !== "ACTIVE" || Boolean(assetIdFilter) || Boolean(debouncedQ);
  const selectedChip = filterToChip(overviewFilter);
  const statusSelectValue = filterToStatusSelect(overviewFilter);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: qk.workOrders(projectId), exact: false });
    await qc.invalidateQueries({ queryKey: qk.omFmDashboard(projectId) });
  }, [qc, projectId]);

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patchIssue(id, { status }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const vendorLinkMut = useMutation({
    mutationFn: (id: string) => postWorkOrderVendorLink(projectId, id),
    onMutate: (id) => setVendorLinkBusyId(id),
    onSettled: () => setVendorLinkBusyId(null),
    onSuccess: (res) => {
      if (res.emailed) toast.success("Vendor link emailed.");
      else toast.success("Vendor link created.", { description: res.link });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiMut = useMutation({
    mutationFn: (id: string) => postWorkOrderAiTroubleshoot(projectId, id),
    onMutate: (id) => setAiBusyId(id),
    onSettled: () => setAiBusyId(null),
    onSuccess: async (res, id) => {
      const wo = rows.find((r) => r.id === id);
      if (!wo) return;
      const steps = res.suggestedSteps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const safety = res.safetyNotes.length
        ? `\n\nSafety:\n${res.safetyNotes.map((s) => `• ${s}`).join("\n")}`
        : "";
      const nextDesc =
        `${wo.description ?? ""}\n\n--- AI assist ---\n${res.summary}\n\nSteps:\n${steps}${safety}`.trim();
      try {
        const updated = await patchIssue(id, { description: nextDesc });
        await refresh();
        setEditIssue(updated);
        toast.success("AI suggestions added to work order notes.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save AI notes.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: woTemplates = [], isPending: woTemplatesPending } = useQuery({
    queryKey: qk.omWorkspaceWorkOrderTemplates(workspaceId ?? ""),
    queryFn: () => fetchOmWorkspaceWorkOrderTemplates(workspaceId!),
    enabled: Boolean(workspaceId) && templateLibOpen,
  });

  const publishTemplateMut = useMutation({
    mutationFn: (wo: IssueRow) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return postOmWorkspaceWorkOrderTemplate(workspaceId, {
        name: wo.title.trim() || "Work order template",
        description: wo.description?.trim() || null,
        workOrderType: (wo.workOrderType as "CORRECTIVE" | undefined) ?? "CORRECTIVE",
        priority: wo.priority ?? null,
        procedureJson: wo.procedureJson ?? [],
      });
    },
    onSuccess: async () => {
      if (workspaceId) {
        await qc.invalidateQueries({
          queryKey: qk.omWorkspaceWorkOrderTemplates(workspaceId),
        });
      }
      toast.success("Saved to company procedure library.");
      setTemplateLibOpen(true);
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return deleteOmWorkspaceWorkOrderTemplate(workspaceId, id);
    },
    onSuccess: async () => {
      if (workspaceId) {
        await qc.invalidateQueries({
          queryKey: qk.omWorkspaceWorkOrderTemplates(workspaceId),
        });
      }
      toast.success("Template removed.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  if (sessionPending) {
    return <EnterpriseLoadingState message="Loading work orders…" label="Loading" />;
  }

  if (!session?.settings.modules.issues) {
    return (
      <p className="text-sm text-[var(--enterprise-text-muted)]">
        Work orders require the issues module in project settings.
      </p>
    );
  }

  const pBase = projectScopedHref(projectId, "", workspaceId);

  function chipCount(key: ChipKey): number | null {
    if (key === "all") return overviewStats.active > 0 ? overviewStats.active : null;
    if (key === "mine") return overviewStats.mine > 0 ? overviewStats.mine : null;
    if (key === "dueToday") return overviewStats.dueToday > 0 ? overviewStats.dueToday : null;
    if (key === "overdue") return overviewStats.overdue > 0 ? overviewStats.overdue : null;
    return null;
  }

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Wrench}
        title="Work orders"
        description="Asset maintenance and repairs — separate from construction issues."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {workspaceId ? (
              <EnterpriseButton
                size="sm"
                variant="secondary"
                onClick={() => setTemplateLibOpen(true)}
              >
                <Library className="h-4 w-4" strokeWidth={2} aria-hidden />
                Procedures
              </EnterpriseButton>
            ) : null}
            <EnterpriseButton size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              New work order
            </EnterpriseButton>
          </div>
        }
      />

      {rows.length > 0 ? (
        <WorkOrdersOverview
          rows={rows}
          filter={overviewFilter}
          onFilterChange={setOverviewFilter}
          currentUserId={currentUserId}
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="enterprise-card flex items-center gap-2 px-3 py-2 sm:px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
          <label className="sr-only" htmlFor="wo-list-search">
            Search work orders
          </label>
          <input
            id="wo-list-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, asset, assignee…"
            className="min-h-10 w-full bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
          />
        </div>
      ) : null}

      <section className="enterprise-card flex flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--enterprise-border)] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="mobile-chip-scroll enterprise-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5"
              role="tablist"
              aria-label="Work order filters"
            >
              {LIST_FILTERS.map((f) => {
                const selected = selectedChip === f.key;
                const count = chipCount(f.key);
                const TabIcon = f.icon;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setOverviewFilter(chipToFilter(f.key))}
                    className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      selected
                        ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                        : "border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                    }`}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    {f.label}
                    {count != null ? (
                      <span
                        className={`tabular-nums ${selected ? "text-white/80" : "text-[var(--enterprise-text-muted)]"}`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-[var(--enterprise-border)] p-0.5"
                role="group"
                aria-label="View mode"
              >
                <button
                  type="button"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${
                    viewMode === "list"
                      ? "bg-[var(--enterprise-primary)] text-white"
                      : "text-[var(--enterprise-text-muted)]"
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" aria-hidden />
                  List
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === "board"}
                  onClick={() => setViewMode("board")}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${
                    viewMode === "board"
                      ? "bg-[var(--enterprise-primary)] text-white"
                      : "text-[var(--enterprise-text-muted)]"
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5" aria-hidden />
                  Board
                </button>
              </div>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setOverviewFilter("ACTIVE");
                    setSearchInput("");
                  }}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                >
                  <RotateCcw className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
                  Reset
                </button>
              ) : null}
              <select
                value={statusSelectValue}
                onChange={(e) => setOverviewFilter(e.target.value as WorkOrdersOverviewFilter)}
                className={`${OM_COMPACT_SELECT} w-auto min-w-[9.5rem] !min-h-8`}
                aria-label="Status filter"
              >
                <option value="ACTIVE">Open / in progress</option>
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open only</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <span className="hidden text-xs text-[var(--enterprise-text-muted)] sm:inline">
                <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {filtered.length}
                </span>{" "}
                shown
              </span>
            </div>
          </div>
        </div>

        {assetIdFilter ? (
          <div className="enterprise-alert-info mx-3 mt-3 rounded-xl px-3 py-2.5 text-sm sm:mx-4">
            Filtered to one asset.{" "}
            <Link
              href={`${pBase}/om/work-orders`}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Show all work orders
            </Link>
          </div>
        ) : null}

        {isPending ? (
          <div className="p-4">
            <EnterpriseLoadingState message="Loading work orders…" label="Loading" />
          </div>
        ) : error ? (
          <p className="enterprise-alert-danger m-3 rounded-xl px-3 py-2.5 text-sm sm:m-4">
            {error instanceof Error ? error.message : "Could not load work orders."}
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <OmEmptyState
              icon={Wrench}
              title="No work orders match"
              description="Create a work order for equipment maintenance, or generate one from preventive schedules."
              action={
                <EnterpriseButton size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  New work order
                </EnterpriseButton>
              }
            />
          </div>
        ) : viewMode === "board" ? (
          <div className="p-2 sm:p-3">
            <WorkOrdersBoard
              rows={filtered}
              movingId={statusMut.isPending ? statusMut.variables?.id : null}
              onOpen={(wo) => setEditIssue(wo)}
              onMove={(id, status) => statusMut.mutate({ id, status })}
            />
          </div>
        ) : (
          <ul className="enterprise-scrollbar max-h-[min(62vh,640px)] space-y-1.5 overflow-y-auto overscroll-contain p-2 sm:p-3">
            {filtered.map((wo) => (
              <li
                key={wo.id}
                id={`wo-${wo.id}`}
                className={
                  highlightWoId === wo.id
                    ? "rounded-xl ring-2 ring-[var(--enterprise-primary)] ring-offset-2 ring-offset-[var(--enterprise-surface)]"
                    : undefined
                }
              >
                <WorkOrderCard
                  wo={wo}
                  onEdit={() => setEditIssue(wo)}
                  onComplete={() => setCompleteIssue(wo)}
                  onStart={() => statusMut.mutate({ id: wo.id, status: "IN_PROGRESS" })}
                  onVendorLink={() => vendorLinkMut.mutate(wo.id)}
                  onAiHelp={() => aiMut.mutate(wo.id)}
                  onMoreActions={() => setActionsWo(wo)}
                  vendorLinkBusy={vendorLinkBusyId === wo.id}
                  aiBusy={aiBusyId === wo.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <WorkOrderCreateSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        workspaceId={workspaceId}
        members={members}
        initialAssetId={assetIdFilter}
        onCreated={refresh}
      />

      <WorkOrderEditSlideOver
        open={Boolean(editIssue)}
        issue={editIssue}
        projectId={projectId}
        workspaceId={workspaceId}
        members={members}
        onClose={() => setEditIssue(null)}
        onSaved={async () => {
          await refresh();
          setEditIssue(null);
        }}
      />

      <WorkOrderCompleteSlideOver
        open={Boolean(completeIssue)}
        issue={completeIssue}
        projectId={projectId}
        onClose={() => setCompleteIssue(null)}
        onCompleted={refresh}
      />

      <WorkOrderMobileActionsSheet
        open={Boolean(actionsWo)}
        wo={actionsWo}
        onClose={() => setActionsWo(null)}
        onEdit={() => {
          if (actionsWo) setEditIssue(actionsWo);
        }}
        onComplete={() => {
          if (actionsWo) setCompleteIssue(actionsWo);
        }}
        onStart={() => {
          if (actionsWo) statusMut.mutate({ id: actionsWo.id, status: "IN_PROGRESS" });
        }}
        onVendorLink={() => {
          if (actionsWo) vendorLinkMut.mutate(actionsWo.id);
        }}
        onAiHelp={() => {
          if (actionsWo) aiMut.mutate(actionsWo.id);
        }}
        vendorLinkBusy={Boolean(actionsWo && vendorLinkBusyId === actionsWo.id)}
        aiBusy={Boolean(actionsWo && aiBusyId === actionsWo.id)}
      />

      <EnterpriseSlideOver
        open={templateLibOpen}
        onClose={() => setTemplateLibOpen(false)}
        panelVariant="floating"
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),420px)]"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        ariaLabelledBy="wo-proc-lib-title"
        bodyClassName="px-3 py-3"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3"
        header={
          <div className="min-w-0">
            <h2
              id="wo-proc-lib-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Company procedures
            </h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Shared checklists for corrective work. Apply when creating a work order.
            </p>
          </div>
        }
        footer={
          <EnterpriseButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => setTemplateLibOpen(false)}
          >
            Done
          </EnterpriseButton>
        }
      >
        {woTemplatesPending ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
            Loading procedures…
          </p>
        ) : woTemplates.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm font-medium text-[var(--enterprise-text)]">No procedures yet</p>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Open a work order with a checklist, then use “Save as procedure” from the edit screen
              — or create one when starting a new WO from a template.
            </p>
            {editIssue?.procedureJson?.length ? (
              <EnterpriseButton
                size="sm"
                className="mt-3"
                loading={publishTemplateMut.isPending}
                onClick={() => publishTemplateMut.mutate(editIssue)}
              >
                Save current edit as procedure
              </EnterpriseButton>
            ) : null}
          </div>
        ) : (
          <ul className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto">
            {woTemplates.map((t: WorkspaceWorkOrderTemplateRow) => {
              const steps = Array.isArray(t.procedureJson) ? t.procedureJson.length : 0;
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
                      {[t.workOrderType, t.priority, `${steps} step${steps === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    disabled={deleteTemplateMut.isPending}
                    onClick={() => {
                      if (!window.confirm(`Remove “${t.name}” from company procedures?`)) return;
                      deleteTemplateMut.mutate(t.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
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

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  LayoutGrid,
  Plus,
  RotateCcw,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { WorkOrderCard } from "@/components/enterprise/WorkOrderCard";
import { WorkOrderCompleteSlideOver } from "@/components/enterprise/WorkOrderCompleteSlideOver";
import { WorkOrderCreateSlideOver } from "@/components/enterprise/WorkOrderCreateSlideOver";
import { WorkOrderEditSlideOver } from "@/components/enterprise/WorkOrderEditSlideOver";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchIssuesForProject,
  fetchProjectSession,
  fetchWorkspaceMembers,
  patchIssue,
  postWorkOrderAiTroubleshoot,
  postWorkOrderVendorLink,
  type IssueRow,
  ProRequiredError,
} from "@/lib/api-client";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_SELECT,
  OM_PAGE_CLASS,
} from "@/lib/omCompactStyles";

type ListFilter = "all" | "mine" | "dueToday" | "overdue";

const LIST_FILTERS: { key: ListFilter; label: string; icon: typeof LayoutGrid }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "mine", label: "Mine", icon: UserRound },
  { key: "dueToday", label: "Due today", icon: Calendar },
  { key: "overdue", label: "Overdue", icon: AlertTriangle },
];

type Props = { projectId: string };

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return d < today;
}

function isDueToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  return (
    d.getUTCFullYear() === today.getUTCFullYear() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCDate() === today.getUTCDate()
  );
}

export function WorkOrdersClient({ projectId }: Props) {
  const searchParams = useSearchParams();
  const assetIdFilter = searchParams.get("assetId") ?? undefined;
  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const currentUserId = me?.user.id;
  const workspaceId = primary?.workspace.id;

  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [editIssue, setEditIssue] = useState<IssueRow | null>(null);
  const [completeIssue, setCompleteIssue] = useState<IssueRow | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [vendorLinkBusyId, setVendorLinkBusyId] = useState<string | null>(null);

  const filterKey = `${listFilter}-${statusFilter}-${assetIdFilter ?? ""}`;

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
    queryKey: qk.workOrders(projectId, filterKey),
    queryFn: () =>
      fetchIssuesForProject(projectId, {
        issueKind: "WORK_ORDER",
        assetId: assetIdFilter,
        ...(listFilter === "mine" ? { assignee: "me" } : {}),
        ...(listFilter === "dueToday" ? { dueToday: true } : {}),
        ...(listFilter === "overdue" ? { overdueOnly: true } : {}),
      }),
    enabled: Boolean(session?.settings.modules.issues),
  });

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    if (statusFilter === "ACTIVE") {
      return rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
    }
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const filterCounts = useMemo(() => {
    let mine = 0;
    let dueToday = 0;
    let overdue = 0;
    for (const r of rows) {
      const active = r.status === "OPEN" || r.status === "IN_PROGRESS";
      if (r.assigneeId && currentUserId && r.assigneeId === currentUserId) mine += 1;
      if (active && isDueToday(r.dueDate)) dueToday += 1;
      if (active && isOverdue(r.dueDate)) overdue += 1;
    }
    return { mine, dueToday, overdue, all: rows.length };
  }, [rows, currentUserId]);

  const filtersActive = listFilter !== "all" || statusFilter !== "ACTIVE" || Boolean(assetIdFilter);

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

  function filterCount(key: ListFilter): number | null {
    if (key === "all") return filterCounts.all > 0 ? filterCounts.all : null;
    if (key === "mine") return filterCounts.mine > 0 ? filterCounts.mine : null;
    if (key === "dueToday") return filterCounts.dueToday > 0 ? filterCounts.dueToday : null;
    if (key === "overdue") return filterCounts.overdue > 0 ? filterCounts.overdue : null;
    return null;
  }

  return (
    <div className={OM_PAGE_CLASS}>
      <header className="mb-3 space-y-2 border-b border-[var(--enterprise-border)] pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Asset maintenance and repairs — separate from construction issues.
          </p>
          <EnterpriseButton
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New work order
          </EnterpriseButton>
        </div>
      </header>

      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="mobile-chip-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Work order filters"
          >
            {LIST_FILTERS.map((f) => {
              const selected = listFilter === f.key;
              const count = filterCount(f.key);
              const TabIcon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setListFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                    selected ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
                  }`}
                  style={selected ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
                >
                  <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {f.label}
                  {count != null ? (
                    <span
                      className={`rounded-full px-1 py-px text-[10px] font-bold tabular-nums ${
                        selected
                          ? "bg-white/20 text-white"
                          : "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setListFilter("all");
                  setStatusFilter("ACTIVE");
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
              >
                <RotateCcw className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
                Reset
              </button>
            ) : null}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${OM_COMPACT_SELECT} w-auto min-w-[9.5rem]`}
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
        <div className="enterprise-alert-info rounded-xl px-3 py-2.5 text-sm">
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
        <EnterpriseLoadingState message="Loading work orders…" label="Loading" />
      ) : error ? (
        <p className="enterprise-alert-danger rounded-xl px-3 py-2.5 text-sm">
          {error instanceof Error ? error.message : "Could not load work orders."}
        </p>
      ) : filtered.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {filtered.map((wo) => (
            <WorkOrderCard
              key={wo.id}
              wo={wo}
              onEdit={() => setEditIssue(wo)}
              onComplete={() => setCompleteIssue(wo)}
              onStart={() => statusMut.mutate({ id: wo.id, status: "IN_PROGRESS" })}
              onVendorLink={() => vendorLinkMut.mutate(wo.id)}
              onAiHelp={() => aiMut.mutate(wo.id)}
              vendorLinkBusy={vendorLinkBusyId === wo.id}
              aiBusy={aiBusyId === wo.id}
            />
          ))}
        </div>
      )}

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
    </div>
  );
}

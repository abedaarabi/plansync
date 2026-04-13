"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Crown, Loader2, Mail, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailInvites,
  fetchProject,
  fetchProjectTeam,
  patchWorkspaceMemberRole,
  removeProjectMember,
  resendEmailInvite,
  revokeEmailInvite,
  sendProjectEmailInvite,
  type EmailInviteKind,
  type EmailInviteRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "./EnterpriseLoadingState";
import {
  filterEmailInvites,
  formatInviteSentAgo,
  inviteInitials,
  inviteKindBadgeClass,
  inviteRowKind,
  pendingInviteKindLabel,
  type InviteKindFilter,
  type InviteStatusFilter,
} from "./inviteListUtils";
import { userInitials } from "@/lib/user-initials";
import { isWorkspaceManager } from "@/lib/workspaceRole";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

const CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.1)";

export function ProjectTeamClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const isAdmin = isWorkspaceManager(primary?.role);
  const actorIsSuperAdmin = primary?.role === "SUPER_ADMIN";
  const currentUserId = me?.user.id;
  const [email, setEmail] = useState("");
  const [inviteKind, setInviteKind] = useState<EmailInviteKind>("INTERNAL");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "SUPER_ADMIN">("MEMBER");
  const [trade, setTrade] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeCompany, setInviteeCompany] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteListKindFilter, setInviteListKindFilter] = useState<InviteKindFilter>("all");
  const [inviteListStatusFilter, setInviteListStatusFilter] = useState<InviteStatusFilter>("all");
  const [inviteListSearch, setInviteListSearch] = useState("");

  const { data: project, isPending: projectPending } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = project?.workspaceId;

  const { data: team, isPending: teamPending } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId),
  });

  const { data: invites = [], isPending: invitesPending } = useQuery({
    queryKey: qk.emailInvites(workspaceId ?? "", projectId),
    queryFn: () => fetchEmailInvites(workspaceId!, { forProjectId: projectId }),
    enabled: Boolean(workspaceId && isAdmin),
  });

  const { data: liveActors = [] } = useQuery({
    queryKey: ["projectTeamLive", projectId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/audit-logs?limit=120`), {
        credentials: "include",
      });
      if (!res.ok) return [] as Array<{ id: string; name: string; email: string; at: string }>;
      const j = (await res.json()) as {
        items: Array<{
          createdAt: string;
          actor: { id: string; name: string; email: string; image: string | null } | null;
          type: string;
        }>;
      };
      const cutoff = Date.now() - 15 * 60 * 1000;
      const map = new Map<string, { id: string; name: string; email: string; at: string }>();
      for (const row of j.items ?? []) {
        if (!row.actor) continue;
        if (new Date(row.createdAt).getTime() < cutoff) continue;
        if (!map.has(row.actor.id)) {
          map.set(row.actor.id, {
            id: row.actor.id,
            name: row.actor.name,
            email: row.actor.email,
            at: row.createdAt,
          });
        }
      }
      return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
    },
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projectTeam(projectId) });
      toast.success("Removed from project");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (args: { userId: string; role: "ADMIN" | "MEMBER" | "SUPER_ADMIN" }) =>
      patchWorkspaceMemberRole(workspaceId!, args.userId, args.role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projectTeam(projectId) });
      if (workspaceId) void qc.invalidateQueries({ queryKey: qk.workspaceMembers(workspaceId) });
      void qc.invalidateQueries({ queryKey: qk.me() });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const superAdminCount = useMemo(
    () => (team?.members ?? []).filter((m) => m.workspaceRole === "SUPER_ADMIN").length,
    [team?.members],
  );

  const isExpiredFn = useCallback((inv: EmailInviteRow) => {
    return new Date(inv.expiresAt).getTime() < Date.now();
  }, []);

  const pendingInviteCount = useMemo(
    () => invites.filter((i) => !i.acceptedAt && !isExpiredFn(i)).length,
    [invites, isExpiredFn],
  );

  const filteredInvites = useMemo(
    () =>
      filterEmailInvites(
        invites,
        {
          kind: inviteListKindFilter,
          status: inviteListStatusFilter,
          search: inviteListSearch,
        },
        isExpiredFn,
      ),
    [invites, inviteListKindFilter, inviteListStatusFilter, inviteListSearch, isExpiredFn],
  );

  const inviteFiltersActive =
    inviteListKindFilter !== "all" ||
    inviteListStatusFilter !== "all" ||
    inviteListSearch.trim() !== "";

  const invalidateInviteQueries = useCallback(() => {
    if (!workspaceId) return;
    void qc.invalidateQueries({ queryKey: qk.emailInvites(workspaceId, projectId) });
    void qc.invalidateQueries({ queryKey: qk.projectTeam(projectId) });
  }, [qc, workspaceId, projectId]);

  const revokeEmailMutation = useMutation({
    mutationFn: (inviteId: string) => {
      if (!workspaceId) throw new Error("Workspace not loaded");
      return revokeEmailInvite(workspaceId, inviteId);
    },
    onSuccess: () => {
      invalidateInviteQueries();
      toast.success("Invite cancelled");
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not cancel invite"),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => {
      if (!workspaceId) throw new Error("Workspace not loaded");
      return resendEmailInvite(workspaceId, inviteId);
    },
    onSuccess: () => {
      invalidateInviteQueries();
      toast.success("Invite resent");
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not resend"),
  });

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setSending(true);
    try {
      await sendProjectEmailInvite(workspaceId, {
        email: email.trim(),
        projectIds: [projectId],
        inviteKind,
        ...(inviteKind === "INTERNAL" ? { role } : { role: "MEMBER" as const }),
        trade: trade.trim() || undefined,
        inviteeName: inviteeName.trim() || undefined,
        inviteeCompany: inviteeCompany.trim() || undefined,
      });
      setEmail("");
      setInviteKind("INTERNAL");
      setTrade("");
      setInviteeName("");
      setInviteeCompany("");
      void qc.invalidateQueries({ queryKey: qk.emailInvites(workspaceId, projectId) });
      void qc.invalidateQueries({ queryKey: qk.projectTeam(projectId) });
      toast.success("Invite sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invite");
    } finally {
      setSending(false);
    }
  }

  if (projectPending || teamPending) {
    return <EnterpriseLoadingState message="Loading project team…" label="Loading project team" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--enterprise-primary)]" />
        <h1 className="text-2xl font-bold text-[var(--enterprise-text)]">Project team</h1>
      </div>

      <div className="enterprise-card border-[var(--enterprise-border)] bg-white p-5">
        <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
          Invite to this project
        </h2>
        {isAdmin ? (
          <form className="mt-3 space-y-3" onSubmit={onInvite}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                  Invite as
                </label>
                <select
                  value={inviteKind}
                  onChange={(e) => setInviteKind(e.target.value as EmailInviteKind)}
                  className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                >
                  <option value="INTERNAL">Internal teammate</option>
                  <option value="CLIENT">Client</option>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                </select>
              </div>
              {inviteKind === "INTERNAL" ? (
                <div>
                  <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                    Workspace role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER" | "SUPER_ADMIN")}
                    className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    {actorIsSuperAdmin ? <option value="SUPER_ADMIN">Super Admin</option> : null}
                  </select>
                </div>
              ) : null}
              {inviteKind === "CONTRACTOR" || inviteKind === "SUBCONTRACTOR" ? (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                    Trade / discipline (optional)
                  </label>
                  <input
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    type="text"
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                    placeholder="e.g. Electrical"
                  />
                </div>
              ) : null}
              {inviteKind !== "INTERNAL" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                      Name (optional)
                    </label>
                    <input
                      value={inviteeName}
                      onChange={(e) => setInviteeName(e.target.value)}
                      type="text"
                      maxLength={200}
                      className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">
                      Company (optional)
                    </label>
                    <input
                      value={inviteeCompany}
                      onChange={(e) => setInviteeCompany(e.target.value)}
                      type="text"
                      maxLength={200}
                      className="h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
                    />
                  </div>
                </>
              ) : null}
            </div>
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              External invites are scoped to this project automatically.
            </p>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Invite
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">
            Only workspace admins can send invites or manage pending invitations. Ask a Super Admin
            or Admin if you need someone added.
          </p>
        )}
      </div>

      <div className="enterprise-card overflow-hidden p-0">
        <div className="border-b border-[var(--enterprise-border)] px-5 py-3 text-sm font-semibold text-[var(--enterprise-text)]">
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            Currently working (last 15 min)
          </span>
        </div>
        {liveActors.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--enterprise-text-muted)]">
            No active collaborators in the last 15 minutes.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--enterprise-border)]">
            {liveActors.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--enterprise-primary-soft)] text-xs font-semibold text-[var(--enterprise-primary)]">
                    {userInitials(u.name, u.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-[var(--enterprise-text-muted)]">
                      {u.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[var(--enterprise-text-muted)]">
                  {new Date(u.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="enterprise-card overflow-hidden p-0">
        <div className="border-b border-[var(--enterprise-border)] px-5 py-3 text-sm font-semibold text-[var(--enterprise-text)]">
          Members ({team?.members.length ?? 0})
        </div>
        <ul className="divide-y divide-[var(--enterprise-border)]">
          {(team?.members ?? []).map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--enterprise-primary-soft)] text-xs font-semibold text-[var(--enterprise-primary)]">
                  {userInitials(m.name, m.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                    {m.name}
                  </p>
                  <p className="truncate text-xs text-[var(--enterprise-text-muted)]">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.workspaceRole === "SUPER_ADMIN" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    <Crown className="h-3 w-3" />
                    Super Admin
                  </span>
                ) : m.workspaceRole === "ADMIN" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                    <Crown className="h-3 w-3" />
                    Admin
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--enterprise-bg)] px-2 py-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                    Member
                  </span>
                )}
                <span className="rounded-full bg-[var(--enterprise-bg)] px-2 py-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                  {m.access === "project" ? "Project only" : "Workspace"}
                </span>
                {isAdmin ? (
                  <select
                    value={m.workspaceRole}
                    disabled={
                      roleMut.isPending ||
                      (m.userId === currentUserId &&
                        m.workspaceRole === "SUPER_ADMIN" &&
                        superAdminCount === 1)
                    }
                    title={
                      m.userId === currentUserId &&
                      m.workspaceRole === "SUPER_ADMIN" &&
                      superAdminCount === 1
                        ? "Add another Super Admin before changing your workspace role"
                        : undefined
                    }
                    onChange={(e) => {
                      const next = e.target.value as "ADMIN" | "MEMBER" | "SUPER_ADMIN";
                      if (next === m.workspaceRole) return;
                      if (
                        m.userId === currentUserId &&
                        m.workspaceRole === "SUPER_ADMIN" &&
                        superAdminCount === 1 &&
                        next !== "SUPER_ADMIN"
                      ) {
                        e.target.value = m.workspaceRole;
                        toast.error(
                          "You are the only Super Admin. Promote someone else to Super Admin before changing your role.",
                        );
                        return;
                      }
                      if (m.userId === currentUserId && next === "MEMBER") {
                        toast.error("You cannot demote yourself here.");
                        return;
                      }
                      roleMut.mutate({ userId: m.userId, role: next });
                    }}
                    className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-[11px] text-[var(--enterprise-text)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Role for ${m.name}`}
                  >
                    {actorIsSuperAdmin ? <option value="SUPER_ADMIN">Super Admin</option> : null}
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                ) : null}
                {isAdmin && m.canRemoveFromProject ? (
                  <button
                    type="button"
                    onClick={() => removeMut.mutate(m.userId)}
                    disabled={removeMut.isPending}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin ? (
        <div
          className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="rounded-t-2xl border-b border-[#E2E8F0] bg-gradient-to-b from-[#F8FAFC] to-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">Email invites</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {pendingInviteCount > 0 ? (
                    <span>
                      <span className="font-medium text-[#0F172A]">{pendingInviteCount}</span>{" "}
                      awaiting response
                    </span>
                  ) : (
                    "No active pending invites"
                  )}
                  {invites.length > 0 && inviteFiltersActive ? (
                    <>
                      {" · "}
                      Showing{" "}
                      <span className="font-medium text-[#0F172A]">
                        {filteredInvites.length}
                      </span>{" "}
                      of {invites.length}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {!invitesPending && invites.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative min-w-0 max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="search"
                    value={inviteListSearch}
                    onChange={(e) => setInviteListSearch(e.target.value)}
                    placeholder="Search email, name, company, trade, project…"
                    className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    aria-label="Filter invites by keyword"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={inviteListKindFilter}
                    onChange={(e) => setInviteListKindFilter(e.target.value as InviteKindFilter)}
                    className="h-10 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    aria-label="Filter by invite type"
                  >
                    <option value="all">All types</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CLIENT">Client</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="SUBCONTRACTOR">Subcontractor</option>
                  </select>
                  <select
                    value={inviteListStatusFilter}
                    onChange={(e) =>
                      setInviteListStatusFilter(e.target.value as InviteStatusFilter)
                    }
                    className="h-10 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                    <option value="joined">Joined</option>
                  </select>
                  {inviteFiltersActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInviteListKindFilter("all");
                        setInviteListStatusFilter("all");
                        setInviteListSearch("");
                      }}
                      className="h-10 rounded-xl border border-transparent px-3 text-sm font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {invitesPending ? (
            <div className="space-y-0 divide-y divide-[#E2E8F0]">
              {[0, 1].map((i) => (
                <div key={i} className="flex animate-pulse gap-4 px-5 py-5 sm:px-6">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-[#E2E8F0]" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="h-4 w-48 max-w-full rounded bg-[#E2E8F0]" />
                    <div className="h-3 w-64 max-w-full rounded bg-[#F1F5F9]" />
                  </div>
                </div>
              ))}
            </div>
          ) : invites.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#64748B]">
                <Mail className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#0F172A]">No email invites yet</p>
              <p className="mt-1 text-sm text-[#64748B]">
                Send one using the form above to add people to this project.
              </p>
            </div>
          ) : filteredInvites.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#0F172A]">No invites match your filters</p>
              <p className="mt-1 text-sm text-[#64748B]">Try another type, status, or search.</p>
              <button
                type="button"
                onClick={() => {
                  setInviteListKindFilter("all");
                  setInviteListStatusFilter("all");
                  setInviteListSearch("");
                }}
                className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {filteredInvites.map((inv) => {
                const expired = !inv.acceptedAt && isExpiredFn(inv);
                const canAct = isAdmin && !inv.acceptedAt && !expired;
                const rowKind = inviteRowKind(inv);
                return (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-[#FAFBFC] sm:px-6"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] text-sm font-bold text-[#3730A3]">
                          {inviteInitials(inv)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[15px] font-semibold text-[#0F172A]">
                              {inv.inviteeName?.trim() || inv.email}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${inviteKindBadgeClass(rowKind)}`}
                            >
                              {pendingInviteKindLabel(inv)}
                            </span>
                            {inv.acceptedAt ? (
                              <span className="shrink-0 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669] ring-1 ring-emerald-200/80">
                                Joined
                              </span>
                            ) : expired ? (
                              <span className="shrink-0 rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626] ring-1 ring-red-200/80">
                                Expired
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309] ring-1 ring-amber-200/80">
                                Pending
                              </span>
                            )}
                          </div>
                          {inv.inviteeName?.trim() ? (
                            <p className="mt-0.5 truncate text-sm text-[#64748B]">{inv.email}</p>
                          ) : null}
                          {inv.inviteeCompany?.trim() ? (
                            <p className="mt-1 text-xs text-[#64748B]">
                              {inv.inviteeCompany.trim()}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                            <span className="font-medium text-[#475569]">
                              {formatInviteSentAgo(inv.createdAt)}
                            </span>
                            {" · "}
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                          <p className="mt-1.5 text-xs text-[#64748B]">
                            <span className="font-medium text-[#475569]">Projects:</span>{" "}
                            {inv.projects.length > 0
                              ? inv.projects.map((p) => p.name).join(", ")
                              : "Full workspace"}
                            {inv.trade?.trim() ? (
                              <>
                                {" · "}
                                <span className="font-medium text-[#475569]">Trade:</span>{" "}
                                {inv.trade.trim()}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      {canAct ? (
                        <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => resendMutation.mutate(inv.id)}
                            disabled={resendMutation.isPending}
                            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeEmailMutation.mutate(inv.id)}
                            disabled={revokeEmailMutation.isPending}
                            className="rounded-xl px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Crown, Loader2, Mail, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  fetchEmailInvites,
  fetchProject,
  fetchProjectTeam,
  patchWorkspaceMemberRole,
  removeProjectMember,
  resendEmailInvite,
  revokeEmailInvite,
  sendProjectEmailInvite,
  type EmailInviteRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "./EnterpriseLoadingState";
import { OmSubPageHeader } from "./OmSubPageHeader";
import { OM_COMPACT_INPUT, OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
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
import { INVITE_KIND_OPTIONS, WORKSPACE_ROLE_OPTIONS } from "./inviteFormOptions";
import { EnterpriseForm } from "./forms/EnterpriseForm";
import { EnterpriseFormField } from "./forms/EnterpriseFormField";
import { EnterpriseInput, EnterpriseSelect } from "./forms/EnterpriseInputs";
import { useEnterpriseForm } from "./forms/useEnterpriseForm";

const projectInviteSchema = z.object({
  email: z.string().trim().min(1, "Enter an email address.").email("Enter a valid email address."),
  inviteKind: z.enum(["INTERNAL", "CLIENT", "CONTRACTOR", "SUBCONTRACTOR"]),
  inviteeCompany: z.string(),
  inviteeName: z.string(),
  role: z.enum(["ADMIN", "MEMBER", "SUPER_ADMIN"]),
  trade: z.string(),
});

type ProjectInviteValues = z.infer<typeof projectInviteSchema>;

export function ProjectTeamClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const isAdmin = isWorkspaceManager(primary?.role);
  const actorIsSuperAdmin = primary?.role === "SUPER_ADMIN";
  const currentUserId = me?.user.id;
  const inviteForm = useEnterpriseForm(projectInviteSchema, {
    email: "",
    inviteKind: "INTERNAL",
    inviteeCompany: "",
    inviteeName: "",
    role: "MEMBER",
    trade: "",
  });
  const inviteKind = inviteForm.watch("inviteKind");
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

  async function onInvite(values: ProjectInviteValues) {
    if (!workspaceId) return;
    setSending(true);
    try {
      await sendProjectEmailInvite(workspaceId, {
        email: values.email.trim(),
        projectIds: [projectId],
        inviteKind: values.inviteKind,
        ...(values.inviteKind === "INTERNAL" ? { role: values.role } : { role: "MEMBER" as const }),
        trade: values.trade.trim() || undefined,
        inviteeName: values.inviteeName.trim() || undefined,
        inviteeCompany: values.inviteeCompany.trim() || undefined,
      });
      inviteForm.reset();
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
    <div className={`${OM_PAGE_CLASS} w-full min-w-0 max-w-full`}>
      <OmSubPageHeader
        icon={Users}
        title="Project team"
        description="Invite collaborators, manage roles, and track who is active on this project."
      />

      <div className="enterprise-card border-[var(--enterprise-border)] bg-white p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
          Invite to this project
        </h2>
        {isAdmin ? (
          <EnterpriseForm
            form={inviteForm}
            density="compact"
            className="mt-3 space-y-3"
            onSubmit={onInvite}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <EnterpriseFormField<ProjectInviteValues> name="email" label="Email" required>
                  {({ describedBy, field, id, invalid }) => (
                    <EnterpriseInput
                      {...field}
                      id={id}
                      type="text"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      placeholder="name@company.com"
                    />
                  )}
                </EnterpriseFormField>
              </div>
              <EnterpriseFormField<ProjectInviteValues> name="inviteKind" label="Invite as">
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseSelect
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  >
                    {INVITE_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </EnterpriseSelect>
                )}
              </EnterpriseFormField>
              {inviteKind === "INTERNAL" ? (
                <EnterpriseFormField<ProjectInviteValues> name="role" label="Workspace role">
                  {({ describedBy, field, id, invalid }) => (
                    <EnterpriseSelect
                      {...field}
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                    >
                      {WORKSPACE_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      {actorIsSuperAdmin ? <option value="SUPER_ADMIN">Super Admin</option> : null}
                    </EnterpriseSelect>
                  )}
                </EnterpriseFormField>
              ) : null}
              {inviteKind === "CONTRACTOR" || inviteKind === "SUBCONTRACTOR" ? (
                <div className="sm:col-span-2">
                  <EnterpriseFormField<ProjectInviteValues>
                    name="trade"
                    label="Trade / discipline (optional)"
                  >
                    {({ describedBy, field, id, invalid }) => (
                      <EnterpriseInput
                        {...field}
                        id={id}
                        maxLength={120}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        placeholder="e.g. Electrical"
                      />
                    )}
                  </EnterpriseFormField>
                </div>
              ) : null}
              {inviteKind !== "INTERNAL" ? (
                <>
                  <EnterpriseFormField<ProjectInviteValues>
                    name="inviteeName"
                    label="Name (optional)"
                  >
                    {({ describedBy, field, id, invalid }) => (
                      <EnterpriseInput
                        {...field}
                        id={id}
                        maxLength={200}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    )}
                  </EnterpriseFormField>
                  <EnterpriseFormField<ProjectInviteValues>
                    name="inviteeCompany"
                    label="Company (optional)"
                  >
                    {({ describedBy, field, id, invalid }) => (
                      <EnterpriseInput
                        {...field}
                        id={id}
                        maxLength={200}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    )}
                  </EnterpriseFormField>
                </>
              ) : null}
            </div>
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              External invites are scoped to this project automatically.
            </p>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Invite
            </button>
          </EnterpriseForm>
        ) : (
          <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">
            Only workspace admins can send invites or manage pending invitations. Ask a Super Admin
            or Admin if you need someone added.
          </p>
        )}
      </div>

      <div className="enterprise-card overflow-hidden p-0">
        <div className="border-b border-[var(--enterprise-border)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)]">
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            Currently working (last 15 min)
          </span>
        </div>
        {liveActors.length === 0 ? (
          <div className="px-3 py-3 text-xs text-[var(--enterprise-text-muted)]">
            No active collaborators in the last 15 minutes.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--enterprise-border)]">
            {liveActors.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
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
        <div className="border-b border-[var(--enterprise-border)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)]">
          Members ({team?.members.length ?? 0})
        </div>
        <ul className="divide-y divide-[var(--enterprise-border)]">
          {(team?.members ?? []).map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2">
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
        <div className="enterprise-card overflow-hidden p-0">
          <div className="border-b border-[var(--enterprise-border)] px-3 py-2.5 sm:px-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold text-[var(--enterprise-text)]">
                  Email invites
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
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
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative min-w-0 max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
                  <input
                    type="search"
                    value={inviteListSearch}
                    onChange={(e) => setInviteListSearch(e.target.value)}
                    placeholder="Search email, name, company, trade, project…"
                    className={`${OM_COMPACT_INPUT} enterprise-field-input--icon-sm`}
                    aria-label="Filter invites by keyword"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={inviteListKindFilter}
                    onChange={(e) => setInviteListKindFilter(e.target.value as InviteKindFilter)}
                    className={OM_COMPACT_SELECT}
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
                    className={OM_COMPACT_SELECT}
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
                      className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)]"
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
                <div key={i} className="flex animate-pulse gap-3 px-3 py-3 sm:px-4">
                  <div className="h-12 w-12 shrink-0 rounded-md bg-[#E2E8F0]" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="h-4 w-48 max-w-full rounded bg-[#E2E8F0]" />
                    <div className="h-3 w-64 max-w-full rounded bg-[#F1F5F9]" />
                  </div>
                </div>
              ))}
            </div>
          ) : invites.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
                <Mail className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--enterprise-text)]">
                No email invites yet
              </p>
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                Send one using the form above to add people to this project.
              </p>
            </div>
          ) : filteredInvites.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                No invites match your filters
              </p>
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
                    className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--enterprise-hover-surface)]/60 sm:px-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] text-sm font-bold text-[#3730A3]">
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
                            className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC] disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeEmailMutation.mutate(inv.id)}
                            disabled={revokeEmailMutation.isPending}
                            className="rounded-md px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
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

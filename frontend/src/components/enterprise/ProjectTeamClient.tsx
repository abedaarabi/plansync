"use client";

import { apiUrl } from "@/lib/api-url";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Crown, Loader2, Mail, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailInvites,
  fetchProject,
  fetchProjectTeam,
  patchWorkspaceMemberRole,
  removeProjectMember,
  sendProjectEmailInvite,
  type EmailInviteRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "./EnterpriseLoadingState";
import { userInitials } from "@/lib/user-initials";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

function isExpired(inv: EmailInviteRow): boolean {
  return new Date(inv.expiresAt).getTime() < Date.now();
}

export function ProjectTeamClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const isAdmin = primary?.role === "ADMIN";
  const currentUserId = me?.user.id;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [sending, setSending] = useState(false);

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
    enabled: Boolean(workspaceId),
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
    mutationFn: (args: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      patchWorkspaceMemberRole(workspaceId!, args.userId, args.role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projectTeam(projectId) });
      if (workspaceId) void qc.invalidateQueries({ queryKey: qk.workspaceMembers(workspaceId) });
      void qc.invalidateQueries({ queryKey: qk.me() });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeInvites = useMemo(
    () => invites.filter((i) => !i.acceptedAt && !isExpired(i)),
    [invites],
  );

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setSending(true);
    try {
      await sendProjectEmailInvite(workspaceId, {
        email: email.trim(),
        role,
        projectIds: [projectId],
      });
      setEmail("");
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
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={onInvite}>
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">Email</label>
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
            <label className="mb-1 block text-xs text-[var(--enterprise-text-muted)]">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
              className="h-10 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
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
                {m.workspaceRole === "ADMIN" ? (
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
                  {m.access === "project_only" ? "Project only" : "Workspace"}
                </span>
                {isAdmin ? (
                  <select
                    value={m.workspaceRole}
                    disabled={roleMut.isPending}
                    onChange={(e) => {
                      const next = e.target.value as "ADMIN" | "MEMBER";
                      if (next === m.workspaceRole) return;
                      if (m.userId === currentUserId && next === "MEMBER") {
                        toast.error("You cannot demote yourself here.");
                        return;
                      }
                      roleMut.mutate({ userId: m.userId, role: next });
                    }}
                    className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-[11px] text-[var(--enterprise-text)]"
                    aria-label={`Role for ${m.name}`}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                ) : null}
                {m.canRemoveFromProject ? (
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

      <div className="enterprise-card overflow-hidden p-0">
        <div className="border-b border-[var(--enterprise-border)] px-5 py-3 text-sm font-semibold text-[var(--enterprise-text)]">
          Pending invites ({activeInvites.length})
        </div>
        {invitesPending ? (
          <div className="px-5 py-4 text-sm text-[var(--enterprise-text-muted)]">
            Loading invites…
          </div>
        ) : activeInvites.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--enterprise-text-muted)]">
            No pending invites.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--enterprise-border)]">
            {activeInvites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <Mail className="h-4 w-4 text-[var(--enterprise-text-muted)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--enterprise-text)]">{inv.email}</p>
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

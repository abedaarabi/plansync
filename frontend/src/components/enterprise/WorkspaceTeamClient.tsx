"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChevronDown,
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Search,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailInvites,
  fetchProjects,
  fetchWorkspaceMembers,
  patchEmailInviteProjects,
  patchWorkspaceMemberProjectAccess,
  patchWorkspaceMemberRole,
  ProRequiredError,
  removeWorkspaceMember,
  resendEmailInvite,
  revokeEmailInvite,
  sendProjectEmailInvite,
  type EmailInviteKind,
  type EmailInviteRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import type { WorkspaceRole } from "@/types/enterprise";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  filterEmailInvites,
  formatInviteSentAgo,
  inviteInitials,
  inviteKindBadgeClass,
  inviteRowKind,
  pendingInviteKindLabel,
  type InviteKindFilter,
  type InviteStatusFilter,
} from "@/components/enterprise/inviteListUtils";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

const CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.1)";

const ROLE_HELP: Record<"SUPER_ADMIN" | "ADMIN" | "MEMBER", string> = {
  SUPER_ADMIN:
    "Company owner: billing, organization branding, project feature toggles, and full access.",
  ADMIN: "Manage team and projects. Cannot change billing or org-wide branding.",
  MEMBER: "View and comment on drawings in projects they’re assigned to.",
};

const INVITE_KIND_HELP: Record<EmailInviteKind, string> = {
  INTERNAL: "Employees and consultants on your team. Uses workspace seats.",
  CLIENT: "Read-focused portal access. Pick at least one project.",
  CONTRACTOR: "Field / trade partner. Pick projects and optionally set trade for drawing scope.",
  SUBCONTRACTOR: "Same as contractor; use for tier-2 trades. Pick projects and trade.",
};

const DROPDOWN_PANEL_Z = 200;
const DROPDOWN_MAX_H = 240;

function ProjectAccessDropdown({
  projectOptions,
  selectedIds,
  onToggleProject,
  ariaLabel = "Project access",
}: {
  projectOptions: { id: string; name: string }[];
  selectedIds: string[];
  onToggleProject: (id: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const listId = `${baseId}-list`;

  const syncPanelPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const openUpward = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(DROPDOWN_MAX_H, openUpward ? spaceAbove - gap : spaceBelow - gap);
    const top = openUpward ? Math.max(margin, r.top - gap - maxHeight) : r.bottom + gap;
    setPanelPos({
      top,
      left: r.left,
      width: Math.max(r.width, 200),
      maxHeight: Math.max(80, maxHeight),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    syncPanelPosition();
  }, [open, syncPanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => syncPanelPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, syncPanelPosition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const summary = useMemo(() => {
    if (selectedIds.length === 0) {
      return "Full workspace";
    }
    if (selectedIds.length === 1) {
      return projectOptions.find((p) => p.id === selectedIds[0])?.name ?? "1 project";
    }
    return `${selectedIds.length} projects`;
  }, [selectedIds, projectOptions]);

  const panel =
    open && mounted && panelPos ? (
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        aria-labelledby={triggerId}
        aria-multiselectable="true"
        className="overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
        style={{
          position: "fixed",
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxHeight,
          zIndex: DROPDOWN_PANEL_Z,
          boxShadow: "0 10px 40px rgba(15,23,42,0.12)",
        }}
      >
        {projectOptions.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[#64748B]">No projects.</p>
        ) : (
          projectOptions.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-[#F8FAFC]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleProject(p.id)}
                  className="h-4 w-4 shrink-0 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/30"
                />
                <span className="min-w-0 flex-1 truncate text-[#0F172A]">{p.name}</span>
              </label>
            );
          })
        )}
      </div>
    ) : null;

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-left text-sm font-medium text-[#0F172A] shadow-sm transition hover:border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function SelfRowMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#64748B] max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
          style={{ boxShadow: "0 10px 40px rgba(15,23,42,0.12)" }}
        >
          <Link
            href="/organization"
            className="block px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
            onClick={() => setOpen(false)}
          >
            Organization & billing
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export type WorkspaceTeamVariant = "full" | "inviteOnly";

/** Workspace-wide team: seats, members, email invites, invite form. Use `embedded` inside Organization. */
export function WorkspaceTeamClient({
  embedded = false,
  variant = "full",
}: {
  embedded?: boolean;
  /** `full` = seats, members, pending invites, and invite form (admins). `inviteOnly` = invite form only. */
  variant?: WorkspaceTeamVariant;
}) {
  const qc = useQueryClient();
  const { primary, me, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";
  const actorIsSuperAdmin = primary?.role === "SUPER_ADMIN";
  const showRoster = variant === "full";

  const { data: peopleData, isPending: membersPending } = useQuery({
    queryKey: qk.workspaceMembers(wid ?? ""),
    queryFn: () => fetchWorkspaceMembers(wid!),
    enabled: Boolean(wid) && showRoster,
  });

  const { data: emailInvites = [], isPending: emailInvitesPending } = useQuery({
    queryKey: qk.emailInvites(wid ?? ""),
    queryFn: () => fetchEmailInvites(wid!),
    enabled: Boolean(wid && isAdmin) && showRoster,
  });

  const { data: workspaceProjects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isAdmin),
  });

  const [email, setEmail] = useState("");
  const [inviteKind, setInviteKind] = useState<EmailInviteKind>("INTERNAL");
  const [role, setRole] = useState<"MEMBER" | "ADMIN" | "SUPER_ADMIN">("MEMBER");
  const [trade, setTrade] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeCompany, setInviteeCompany] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectOptions = useMemo(
    () => workspaceProjects.map((p) => ({ id: p.id, name: p.name })),
    [workspaceProjects],
  );

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleInviteDraftProject(id: string) {
    setInviteDraftProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleMemberDraftProject(id: string) {
    setMemberDraftProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const invalidateInviteQueries = () => {
    if (!wid) return;
    void qc.invalidateQueries({ queryKey: ["emailInvites", wid] });
    void qc.invalidateQueries({ queryKey: qk.workspaceMembers(wid) });
    void qc.invalidateQueries({ queryKey: qk.dashboard(wid) });
  };

  const invalidateMemberQueries = () => {
    if (!wid) return;
    void qc.invalidateQueries({ queryKey: qk.workspaceMembers(wid) });
    void qc.invalidateQueries({ queryKey: qk.dashboard(wid) });
    void qc.invalidateQueries({ queryKey: qk.projects(wid) });
  };

  const [editingInviteId, setEditingInviteId] = useState<string | null>(null);
  const [inviteDraftProjectIds, setInviteDraftProjectIds] = useState<string[]>([]);
  const [editingMemberUserId, setEditingMemberUserId] = useState<string | null>(null);
  const [memberDraftProjectIds, setMemberDraftProjectIds] = useState<string[]>([]);
  const [inviteListKindFilter, setInviteListKindFilter] = useState<InviteKindFilter>("all");
  const [inviteListStatusFilter, setInviteListStatusFilter] = useState<InviteStatusFilter>("all");
  const [inviteListSearch, setInviteListSearch] = useState("");

  const revokeEmailMutation = useMutation({
    mutationFn: (inviteId: string) => revokeEmailInvite(wid!, inviteId),
    onSuccess: () => {
      invalidateInviteQueries();
    },
  });

  const updateInviteProjectsMutation = useMutation({
    mutationFn: ({ inviteId, projectIds }: { inviteId: string; projectIds: string[] }) =>
      patchEmailInviteProjects(wid!, inviteId, projectIds),
    onSuccess: () => {
      setEditingInviteId(null);
      invalidateInviteQueries();
      toast.success("Projects updated", {
        id: "team-invite-projects-updated",
        description: "Future emails will list the updated projects when you resend.",
        duration: 4000,
        position: "top-right",
        className: "!border !border-[#D1FAE5] !bg-white !text-[#0F172A] !shadow-lg",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not update projects");
    },
  });

  const updateMemberProjectsMutation = useMutation({
    mutationFn: ({ userId, projectIds }: { userId: string; projectIds: string[] }) =>
      patchWorkspaceMemberProjectAccess(wid!, userId, projectIds),
    onSuccess: () => {
      setEditingMemberUserId(null);
      invalidateMemberQueries();
      toast.success("Project access updated");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not update access");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeWorkspaceMember(wid!, userId),
    onSuccess: () => {
      invalidateMemberQueries();
      toast.success("Member removed from workspace");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not remove member");
    },
  });

  const patchRoleMutation = useMutation({
    mutationFn: (args: { userId: string; role: WorkspaceRole }) =>
      patchWorkspaceMemberRole(wid!, args.userId, args.role),
    onSuccess: () => {
      if (!wid) return;
      invalidateMemberQueries();
      void qc.invalidateQueries({ queryKey: qk.me() });
      toast.success("Role updated");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      if (wid) void qc.invalidateQueries({ queryKey: qk.workspaceMembers(wid) });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => resendEmailInvite(wid!, inviteId),
    onSuccess: () => {
      invalidateInviteQueries();
      toast.success("Invite resent", {
        id: "team-invite-resent",
        description: "They’ll receive another email shortly.",
        duration: 4000,
        position: "top-right",
        className: "!border !border-[#D1FAE5] !bg-white !text-[#0F172A] !shadow-lg",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not resend");
    },
  });

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !email.trim()) return;
    if (inviteKind !== "INTERNAL" && selectedProjectIds.length === 0) {
      setError(
        "Client, contractor, and subcontractor invites must include at least one project. Select projects below.",
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendProjectEmailInvite(wid, {
        email: email.trim(),
        projectIds: selectedProjectIds,
        inviteKind,
        ...(inviteKind === "INTERNAL" ? { role } : { role: "MEMBER" as const }),
        trade: trade.trim() || undefined,
        inviteeName: inviteeName.trim() || undefined,
        inviteeCompany: inviteeCompany.trim() || undefined,
        expiresInDays: 14,
      });
      const addr = email.trim();
      setEmail("");
      setInviteKind("INTERNAL");
      setTrade("");
      setInviteeName("");
      setInviteeCompany("");
      invalidateInviteQueries();
      toast.success(`Invite sent to ${addr}`, {
        id: "team-invite-sent",
        description: "They’ll receive an email with a link to join.",
        duration: 4000,
        position: "top-right",
        className: "!border !border-[#D1FAE5] !bg-white !text-[#0F172A] !shadow-lg",
      });
    } catch (err) {
      if (err instanceof ProRequiredError) {
        setError("Pro subscription required.");
      } else {
        setError(err instanceof Error ? err.message : "Could not send invite.");
      }
    } finally {
      setSending(false);
    }
  }

  const currentUser = me?.user;
  const maxSeats = peopleData?.maxSeats ?? 5;
  const seatPressure = peopleData?.seatPressure ?? 0;
  const seatsRemaining = Math.max(0, maxSeats - seatPressure);
  const seatPct = Math.min(100, (seatPressure / maxSeats) * 100);
  const teamMembers = peopleData?.members ?? [];
  const otherMembers = teamMembers.filter((m) => m.userId !== currentUser?.id);
  const superAdminCount = useMemo(
    () => teamMembers.filter((m) => m.role === "SUPER_ADMIN").length,
    [teamMembers],
  );

  const isExpired = useCallback((inv: EmailInviteRow) => {
    return new Date(inv.expiresAt).getTime() < Date.now();
  }, []);

  const filteredEmailInvites = useMemo(
    () =>
      filterEmailInvites(
        emailInvites,
        {
          kind: inviteListKindFilter,
          status: inviteListStatusFilter,
          search: inviteListSearch,
        },
        isExpired,
      ),
    [emailInvites, inviteListKindFilter, inviteListStatusFilter, inviteListSearch, isExpired],
  );

  const pendingEmailCount = emailInvites.filter((i) => !i.acceptedAt && !isExpired(i)).length;
  const pendingTotal = pendingEmailCount;
  const showPendingSection = isAdmin && showRoster;
  const inviteFiltersActive =
    inviteListKindFilter !== "all" ||
    inviteListStatusFilter !== "all" ||
    inviteListSearch.trim() !== "";

  if (ctxLoading) {
    return <EnterpriseLoadingState message="Loading team…" label="Loading workspace team" />;
  }

  return (
    <div
      className="font-[family-name:var(--font-inter)] text-[#0F172A]"
      style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
    >
      {!embedded ? (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Team</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Manage workspace members, seats, and invites
            </p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() =>
                document.getElementById("invite-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          ) : null}
        </div>
      ) : null}

      {showRoster ? (
        <div
          className="mb-8 rounded-xl border border-[#E2E8F0] bg-white p-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <Users className="h-4 w-4 text-[#2563EB]" />
            Team seats
          </div>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className={`h-full rounded-full bg-[#2563EB] transition-all duration-500 ${membersPending ? "animate-pulse" : ""}`}
                style={{ width: membersPending ? "40%" : `${seatPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-[#64748B]">
              <span className="font-medium text-[#0F172A]">
                {membersPending ? "…" : seatPressure} of {maxSeats}
              </span>{" "}
              seats used
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              {seatsRemaining} seat{seatsRemaining !== 1 ? "s" : ""} remaining on Pro plan ·{" "}
              <Link href="/organization" className="font-medium text-[#2563EB] hover:underline">
                Organization settings
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      {showRoster ? (
        <div
          className="mb-8 overflow-visible rounded-xl border border-[#E2E8F0] bg-white"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="overflow-hidden rounded-t-xl border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Members{" "}
              <span className="font-normal text-[#94A3B8]">
                ({membersPending ? "…" : teamMembers.length})
              </span>
            </h2>
          </div>

          {membersPending ? (
            <div className="divide-y divide-[#E2E8F0]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-6 py-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#E2E8F0]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 max-w-[200px] rounded bg-[#E2E8F0]" />
                    <div className="h-3 max-w-[260px] rounded bg-[#F1F5F9]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[#E2E8F0]">
                {teamMembers.map((m) => {
                  const isYou = m.userId === currentUser?.id;
                  const canManageMember = isAdmin && !isYou;
                  const scoped = m.scopedProjects;
                  const editingThisMember = editingMemberUserId === m.userId;
                  return (
                    <li key={m.userId} className="group flex flex-col gap-3 px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
                            {m.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0F172A]">
                              {m.name}
                            </p>
                            <p className="truncate text-xs text-[#64748B]">{m.email}</p>
                            {isAdmin && scoped !== undefined ? (
                              <p className="mt-1 text-xs text-[#64748B]">
                                {scoped.length === 0
                                  ? "Full workspace"
                                  : `Projects: ${scoped.map((p) => p.name).join(", ")}`}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          {m.role === "SUPER_ADMIN" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              <Crown className="h-3 w-3" />
                              Super Admin
                            </span>
                          ) : m.role === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                              <Crown className="h-3 w-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-semibold text-[#64748B]">
                              Member
                            </span>
                          )}
                          <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
                            Active
                          </span>
                          {isYou ? (
                            <>
                              <span className="text-[11px] text-[#94A3B8]">You</span>
                              <SelfRowMenu />
                            </>
                          ) : null}
                          {isAdmin ? (
                            <select
                              value={m.role}
                              onChange={(e) => {
                                const next = e.target.value as "ADMIN" | "MEMBER" | "SUPER_ADMIN";
                                if (next === m.role) return;
                                if (
                                  isYou &&
                                  m.role === "SUPER_ADMIN" &&
                                  superAdminCount === 1 &&
                                  next !== "SUPER_ADMIN"
                                ) {
                                  e.target.value = m.role;
                                  toast.error(
                                    "You are the only Super Admin. Promote someone else to Super Admin before changing your role.",
                                  );
                                  return;
                                }
                                if (
                                  (m.role === "ADMIN" || m.role === "SUPER_ADMIN") &&
                                  next === "MEMBER"
                                ) {
                                  if (
                                    !window.confirm(
                                      "Demote this user to member? They will lose admin capabilities.",
                                    )
                                  ) {
                                    e.target.value = m.role;
                                    return;
                                  }
                                }
                                patchRoleMutation.mutate({ userId: m.userId, role: next });
                              }}
                              disabled={
                                patchRoleMutation.isPending ||
                                (isYou && m.role === "SUPER_ADMIN" && superAdminCount === 1)
                              }
                              title={
                                isYou && m.role === "SUPER_ADMIN" && superAdminCount === 1
                                  ? "Add another Super Admin before changing your workspace role"
                                  : undefined
                              }
                              className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs font-medium text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Role for ${m.name}`}
                            >
                              {actorIsSuperAdmin ? (
                                <option value="SUPER_ADMIN">Super Admin</option>
                              ) : null}
                              <option value="ADMIN">Admin</option>
                              <option value="MEMBER">Member</option>
                            </select>
                          ) : null}
                          {canManageMember ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingThisMember) {
                                    setEditingMemberUserId(null);
                                  } else {
                                    setEditingMemberUserId(m.userId);
                                    setMemberDraftProjectIds((scoped ?? []).map((p) => p.id));
                                  }
                                }}
                                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-[#F8FAFC]"
                              >
                                {editingThisMember ? "Close" : "Edit projects"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Remove ${m.name ?? m.email} from this workspace? They will lose access to all projects here.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  removeMemberMutation.mutate(m.userId);
                                }}
                                disabled={removeMemberMutation.isPending}
                                className="text-xs font-medium text-[#DC2626] hover:underline disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {canManageMember && editingThisMember ? (
                        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                          <p className="mb-2 text-xs text-[#64748B]">
                            No projects selected = full workspace. Select one or more to limit
                            access.
                          </p>
                          {projectOptions.length === 0 ? (
                            <p className="text-sm text-[#64748B]">No projects in workspace.</p>
                          ) : (
                            <ProjectAccessDropdown
                              ariaLabel={`Project access for ${m.name ?? m.email}`}
                              projectOptions={projectOptions}
                              selectedIds={memberDraftProjectIds}
                              onToggleProject={toggleMemberDraftProject}
                            />
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateMemberProjectsMutation.mutate({
                                  userId: m.userId,
                                  projectIds: memberDraftProjectIds,
                                })
                              }
                              disabled={updateMemberProjectsMutation.isPending}
                              className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                            >
                              {updateMemberProjectsMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Save access"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberUserId(null)}
                              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {otherMembers.length === 0 ? (
                <div className="px-6 py-10">
                  <div className="mx-auto max-w-md rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-8 text-center">
                    <p className="text-sm font-medium text-[#0F172A]">
                      You&apos;re the only member so far
                    </p>
                    <p className="mt-2 text-sm text-[#64748B]">
                      Invite colleagues — use the{" "}
                      <span className="font-medium text-[#0F172A]">Invite member</span>{" "}
                      {embedded ? "tab" : isAdmin ? "section below" : "(ask an admin)"}.
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {showPendingSection ? (
        <div
          className="mb-8 overflow-visible rounded-2xl border border-[#E2E8F0] bg-white"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="rounded-t-2xl border-b border-[#E2E8F0] bg-gradient-to-b from-[#F8FAFC] to-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">Email invites</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {pendingTotal > 0 ? (
                    <span>
                      <span className="font-medium text-[#0F172A]">{pendingTotal}</span> awaiting
                      response
                    </span>
                  ) : (
                    "No active pending invites"
                  )}
                  {emailInvites.length > 0 && inviteFiltersActive ? (
                    <>
                      {" · "}
                      Showing{" "}
                      <span className="font-medium text-[#0F172A]">
                        {filteredEmailInvites.length}
                      </span>{" "}
                      of {emailInvites.length}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {!emailInvitesPending && emailInvites.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative min-w-0 flex-1 max-w-md">
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
          {emailInvitesPending ? (
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
          ) : emailInvites.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#64748B]">
                <Mail className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#0F172A]">No email invites yet</p>
              <p className="mt-1 text-sm text-[#64748B]">
                Send one from the Invite member tab or your project team page.
              </p>
            </div>
          ) : filteredEmailInvites.length === 0 ? (
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
              {filteredEmailInvites.map((inv) => {
                const expired = !inv.acceptedAt && isExpired(inv);
                const canAct = isAdmin && !inv.acceptedAt && !expired;
                const editingThisInvite = editingInviteId === inv.id;
                const rowKind = inviteRowKind(inv);
                return (
                  <li
                    key={`email-${inv.id}`}
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
                            onClick={() => {
                              if (editingThisInvite) {
                                setEditingInviteId(null);
                              } else {
                                setEditingInviteId(inv.id);
                                setInviteDraftProjectIds(inv.projects.map((p) => p.id));
                              }
                            }}
                            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC]"
                          >
                            {editingThisInvite ? "Close" : "Edit projects"}
                          </button>
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
                    {canAct && editingThisInvite ? (
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                        <p className="mb-2 text-xs text-[#64748B]">
                          Changes apply to this pending invite. Resend the email so they see the
                          updated project list.
                        </p>
                        {projectOptions.length === 0 ? (
                          <p className="text-sm text-[#64748B]">No projects in workspace.</p>
                        ) : (
                          <ProjectAccessDropdown
                            ariaLabel={`Projects for invite ${inv.email}`}
                            projectOptions={projectOptions}
                            selectedIds={inviteDraftProjectIds}
                            onToggleProject={toggleInviteDraftProject}
                          />
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateInviteProjectsMutation.mutate({
                                inviteId: inv.id,
                                projectIds: inviteDraftProjectIds,
                              })
                            }
                            disabled={updateInviteProjectsMutation.isPending}
                            className="rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-50"
                          >
                            {updateInviteProjectsMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save projects"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingInviteId(null)}
                            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {isAdmin && variant === "inviteOnly" ? (
        <div
          id="invite-section"
          className="rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Invite by email</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Send a branded invite — they&apos;ll get a link to create an account and join your
            workspace. Manage seats, members, and pending invites on the{" "}
            <span className="font-medium text-[#0F172A]">People</span> tab.
          </p>

          <form onSubmit={onInvite} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="team-invite-email"
                className="mb-1.5 block text-sm font-medium text-[#0F172A]"
              >
                Email address
              </label>
              <input
                id="team-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                placeholder="colleague@company.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="team-invite-kind"
                className="mb-1.5 block text-sm font-medium text-[#0F172A]"
              >
                Invite as
              </label>
              <div className="relative">
                <select
                  id="team-invite-kind"
                  value={inviteKind}
                  onChange={(e) => setInviteKind(e.target.value as EmailInviteKind)}
                  className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-10 text-sm font-medium text-[#0F172A] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                >
                  <option value="INTERNAL">Internal teammate</option>
                  <option value="CLIENT">Client</option>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                {INVITE_KIND_HELP[inviteKind]}
              </p>
            </div>

            {inviteKind === "INTERNAL" ? (
              <div>
                <label
                  htmlFor="team-invite-role"
                  className="mb-1.5 block text-sm font-medium text-[#0F172A]"
                >
                  Workspace role
                </label>
                <div className="relative">
                  <select
                    id="team-invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN" | "SUPER_ADMIN")}
                    className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-10 text-sm font-medium text-[#0F172A] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    {actorIsSuperAdmin ? <option value="SUPER_ADMIN">Super Admin</option> : null}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                  {ROLE_HELP[role as keyof typeof ROLE_HELP] ?? ROLE_HELP.MEMBER}
                </p>
              </div>
            ) : null}

            {inviteKind === "CONTRACTOR" || inviteKind === "SUBCONTRACTOR" ? (
              <div>
                <label
                  htmlFor="team-invite-trade"
                  className="mb-1.5 block text-sm font-medium text-[#0F172A]"
                >
                  Trade / discipline <span className="font-normal text-[#64748B]">(optional)</span>
                </label>
                <input
                  id="team-invite-trade"
                  type="text"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  autoComplete="off"
                  maxLength={120}
                  className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  placeholder="e.g. Electrical, Concrete"
                />
              </div>
            ) : null}

            {inviteKind !== "INTERNAL" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="team-invite-name"
                    className="mb-1.5 block text-sm font-medium text-[#0F172A]"
                  >
                    Invitee name <span className="font-normal text-[#64748B]">(optional)</span>
                  </label>
                  <input
                    id="team-invite-name"
                    type="text"
                    value={inviteeName}
                    onChange={(e) => setInviteeName(e.target.value)}
                    autoComplete="off"
                    maxLength={200}
                    className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    placeholder="First Last"
                  />
                </div>
                <div>
                  <label
                    htmlFor="team-invite-company"
                    className="mb-1.5 block text-sm font-medium text-[#0F172A]"
                  >
                    Company <span className="font-normal text-[#64748B]">(optional)</span>
                  </label>
                  <input
                    id="team-invite-company"
                    type="text"
                    value={inviteeCompany}
                    onChange={(e) => setInviteeCompany(e.target.value)}
                    autoComplete="off"
                    maxLength={200}
                    className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    placeholder="Company name"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <span className="mb-3 block text-sm font-medium text-[#0F172A]">Grant access to</span>
              {projectOptions.length === 0 ? (
                <p className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-4 text-sm text-[#64748B]">
                  No projects in workspace.
                </p>
              ) : (
                <ProjectAccessDropdown
                  ariaLabel="Grant access to projects"
                  projectOptions={projectOptions}
                  selectedIds={selectedProjectIds}
                  onToggleProject={toggleProject}
                />
              )}
              <p className="mt-2 text-[13px] text-[#64748B]">
                {inviteKind === "INTERNAL" ? (
                  <>
                    Leave none selected for{" "}
                    <span className="font-medium text-[#0F172A]">Full workspace</span> — or pick one
                    or more projects to limit access.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-[#0F172A]">Required:</span> select one or more
                    projects. External invites cannot use “full workspace” without a project list.
                  </>
                )}
              </p>
            </div>

            {error ? <p className="text-sm text-[#DC2626]">{error}</p> : null}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Invite
                    <ArrowRight className="h-4 w-4 opacity-90" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

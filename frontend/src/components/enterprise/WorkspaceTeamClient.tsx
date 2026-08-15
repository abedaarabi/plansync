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
import { z } from "zod";
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
  EnterpriseButton,
  enterpriseButtonClassName,
} from "@/components/enterprise/EnterpriseButton";
import { INVITE_KIND_OPTIONS, WORKSPACE_ROLE_OPTIONS } from "./inviteFormOptions";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput, EnterpriseSelect } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
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

export const workspaceInviteSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    inviteKind: z.enum(["INTERNAL", "CLIENT", "CONTRACTOR", "SUBCONTRACTOR"]),
    inviteeCompany: z.string(),
    inviteeName: z.string(),
    projectIds: z.array(z.string()),
    role: z.enum(["MEMBER", "ADMIN", "SUPER_ADMIN"]),
    trade: z.string(),
  })
  .superRefine((values, context) => {
    if (values.inviteKind !== "INTERNAL" && values.projectIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client, contractor, and subcontractor invites must include at least one project.",
        path: ["projectIds"],
      });
    }
  });

type WorkspaceInviteValues = z.infer<typeof workspaceInviteSchema>;

const WORKSPACE_INVITE_DEFAULTS: WorkspaceInviteValues = {
  email: "",
  inviteKind: "INTERNAL",
  inviteeCompany: "",
  inviteeName: "",
  projectIds: [],
  role: "MEMBER",
  trade: "",
};

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
        className="overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-lg"
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
          <p className="px-3 py-3 text-sm text-[var(--enterprise-text-muted)]">No projects.</p>
        ) : (
          projectOptions.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-[var(--enterprise-bg)] mobile-tappable-row min-h-14 active:scale-[0.99]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleProject(p.id)}
                  className="h-4 w-4 shrink-0 rounded border-[var(--enterprise-border)] text-[var(--enterprise-primary)] focus:ring-2 focus:ring-[var(--enterprise-primary)]/30"
                />
                <span className="min-w-0 flex-1 truncate text-[var(--enterprise-text)]">
                  {p.name}
                </span>
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
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-left text-sm font-medium text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-border)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
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
        className="rounded-md p-1.5 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text-muted)] max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-lg"
          style={{ boxShadow: "0 10px 40px rgba(15,23,42,0.12)" }}
        >
          <Link
            href="/organization"
            className="block px-3 py-2 text-sm text-[var(--enterprise-text)] hover:bg-[var(--enterprise-bg)]"
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
// fallow-ignore-next-line complexity
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

  const inviteForm = useEnterpriseForm(workspaceInviteSchema, WORKSPACE_INVITE_DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const projectOptions = useMemo(
    () => workspaceProjects.map((p) => ({ id: p.id, name: p.name })),
    [workspaceProjects],
  );

  function toggleProject(id: string) {
    const selectedProjectIds = inviteForm.getValues("projectIds");
    inviteForm.setValue(
      "projectIds",
      selectedProjectIds.includes(id)
        ? selectedProjectIds.filter((projectId) => projectId !== id)
        : [...selectedProjectIds, id],
      { shouldValidate: true },
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
        className:
          "!border !border-[var(--enterprise-semantic-success-border)] !bg-[var(--enterprise-surface)] !text-[var(--enterprise-text)] !shadow-lg",
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
        className:
          "!border !border-[var(--enterprise-semantic-success-border)] !bg-[var(--enterprise-surface)] !text-[var(--enterprise-text)] !shadow-lg",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not resend");
    },
  });

  async function onInvite(values: WorkspaceInviteValues) {
    if (!wid) return;
    setSending(true);
    setError(null);
    try {
      await sendProjectEmailInvite(wid, {
        email: values.email.trim(),
        projectIds: values.projectIds,
        inviteKind: values.inviteKind,
        ...(values.inviteKind === "INTERNAL" ? { role: values.role } : { role: "MEMBER" as const }),
        trade: values.trade.trim() || undefined,
        inviteeName: values.inviteeName.trim() || undefined,
        inviteeCompany: values.inviteeCompany.trim() || undefined,
        expiresInDays: 14,
      });
      const addr = values.email.trim();
      inviteForm.reset(WORKSPACE_INVITE_DEFAULTS);
      invalidateInviteQueries();
      toast.success(`Invite sent to ${addr}`, {
        id: "team-invite-sent",
        description: "They’ll receive an email with a link to join.",
        duration: 4000,
        position: "top-right",
        className:
          "!border !border-[var(--enterprise-semantic-success-border)] !bg-[var(--enterprise-surface)] !text-[var(--enterprise-text)] !shadow-lg",
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
  const maxSeatCap = peopleData?.maxSeats ?? 250;
  const includedSeats = peopleData?.includedSeats ?? 5;
  const extraSeatUsd = peopleData?.extraSeatMonthlyUsd ?? 15;
  const seatPressure = peopleData?.seatPressure ?? 0;
  const seatsRemainingUntilCap = Math.max(0, maxSeatCap - seatPressure);
  const seatDenominator = Math.max(includedSeats, 1);
  const seatPct = Math.min(100, (seatPressure / seatDenominator) * 100);
  const extraSeatCount = Math.max(0, seatPressure - includedSeats);
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
  const inviteKind = inviteForm.watch("inviteKind");
  const role = inviteForm.watch("role");
  const selectedProjectIds = inviteForm.watch("projectIds");

  if (ctxLoading) {
    return <EnterpriseLoadingState message="Loading team…" label="Loading workspace team" />;
  }

  return (
    <div className="enterprise-animate-in space-y-5 text-[var(--enterprise-text)]">
      {!embedded ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
              Team
            </h1>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
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
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          ) : null}
        </div>
      ) : null}

      {showRoster ? (
        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-border)]"
                  aria-hidden
                >
                  <Users className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                    People
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                    Team seats &amp; members
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
                    Manage who can access this workspace. Included seats cover your core team;
                    extras are added to your Stripe subscription (prorated) when you grow past the
                    plan allowance.
                  </p>
                </div>
              </div>
              {isAdmin && embedded ? (
                <Link
                  href="/organization?tab=invite-member"
                  className={enterpriseButtonClassName({
                    variant: "primary",
                    size: "md",
                    className: "mobile-touch-target",
                  })}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Invite member
                </Link>
              ) : null}
            </div>
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--enterprise-border)]">
                <div
                  className={`h-full rounded-full bg-[var(--enterprise-primary)] transition-all duration-500 ${membersPending ? "animate-pulse" : ""}`}
                  style={{ width: membersPending ? "40%" : `${seatPct}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">
                <span className="font-medium text-[var(--enterprise-text)]">
                  {membersPending ? "…" : seatPressure} of {includedSeats}
                </span>{" "}
                included seats used
                {extraSeatCount > 0 && !membersPending ? (
                  <span className="text-[var(--enterprise-semantic-warning-text)]">
                    {" "}
                    · +{extraSeatCount} extra × ${extraSeatUsd}/mo
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                {seatsRemainingUntilCap} seat{seatsRemainingUntilCap !== 1 ? "s" : ""} remaining
                before workspace cap
                {pendingTotal > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      {pendingTotal}
                    </span>{" "}
                    pending invite{pendingTotal === 1 ? "" : "s"}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showRoster ? (
        <div className="enterprise-card overflow-visible">
          <div className="border-b border-[var(--enterprise-border)] px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
              Members{" "}
              <span className="font-normal text-[var(--enterprise-text-muted)]">
                ({membersPending ? "…" : teamMembers.length})
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Roles control billing, branding, and who can invite others.
            </p>
          </div>

          {membersPending ? (
            <div className="divide-y divide-[var(--enterprise-border)]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-6 py-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--enterprise-border)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 max-w-[200px] rounded bg-[var(--enterprise-border)]" />
                    <div className="h-3 max-w-[260px] rounded bg-[var(--enterprise-hover-surface)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[var(--enterprise-border)]">
                {teamMembers.map(
                  // fallow-ignore-next-line complexity
                  (m) => {
                    const isYou = m.userId === currentUser?.id;
                    const canManageMember = isAdmin && !isYou;
                    const scoped = m.scopedProjects;
                    const editingThisMember = editingMemberUserId === m.userId;
                    return (
                      <li key={m.userId} className="group flex flex-col gap-3 px-6 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--enterprise-primary)] text-sm font-semibold text-white">
                              {m.name?.charAt(0).toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                                {m.name}
                              </p>
                              <p className="truncate text-xs text-[var(--enterprise-text-muted)]">
                                {m.email}
                              </p>
                              {isAdmin && scoped !== undefined ? (
                                <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
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
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-primary)]">
                                <Crown className="h-3 w-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="rounded-full bg-[var(--enterprise-hover-surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-text-muted)]">
                                Member
                              </span>
                            )}
                            <span className="rounded-full bg-[var(--enterprise-semantic-success-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-success-text)]">
                              Active
                            </span>
                            {isYou ? (
                              <>
                                <span className="text-[11px] text-[var(--enterprise-text-muted)]">
                                  You
                                </span>
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
                                className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-xs font-medium text-[var(--enterprise-text)] disabled:cursor-not-allowed disabled:opacity-60"
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
                                  className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)]"
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
                                  className="text-xs font-medium text-[var(--enterprise-semantic-danger-text)] hover:underline disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {canManageMember && editingThisMember ? (
                          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-4">
                            <p className="mb-2 text-xs text-[var(--enterprise-text-muted)]">
                              No projects selected = full workspace. Select one or more to limit
                              access.
                            </p>
                            {projectOptions.length === 0 ? (
                              <p className="text-sm text-[var(--enterprise-text-muted)]">
                                No projects in workspace.
                              </p>
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
                                className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50"
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
                                className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-surface)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  },
                )}
              </ul>
              {otherMembers.length === 0 ? (
                <div className="px-6 py-10">
                  <div className="mx-auto max-w-md rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-6 py-8 text-center">
                    <p className="text-sm font-medium text-[var(--enterprise-text)]">
                      You&apos;re the only member so far
                    </p>
                    <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                      Invite colleagues — use the{" "}
                      <span className="font-medium text-[var(--enterprise-text)]">
                        Invite member
                      </span>{" "}
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
        <div className="enterprise-card overflow-visible">
          <div className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
                  Email invites
                </h2>
                <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                  {pendingTotal > 0 ? (
                    <span>
                      <span className="font-medium text-[var(--enterprise-text)]">
                        {pendingTotal}
                      </span>{" "}
                      awaiting response
                    </span>
                  ) : (
                    "No active pending invites"
                  )}
                  {emailInvites.length > 0 && inviteFiltersActive ? (
                    <>
                      {" · "}
                      Showing{" "}
                      <span className="font-medium text-[var(--enterprise-text)]">
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
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
                  <input
                    type="search"
                    value={inviteListSearch}
                    onChange={(e) => setInviteListSearch(e.target.value)}
                    placeholder="Search email, name, company, trade, project…"
                    className="h-10 w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-2 pl-10 pr-3 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                    aria-label="Filter invites by keyword"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={inviteListKindFilter}
                    onChange={(e) => setInviteListKindFilter(e.target.value as InviteKindFilter)}
                    className="h-10 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-medium text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
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
                    className="h-10 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-medium text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
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
                      className="h-10 rounded-md border border-transparent px-3 text-sm font-medium text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)]"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {emailInvitesPending ? (
            <div className="space-y-0 divide-y divide-[var(--enterprise-border)]">
              {[0, 1].map((i) => (
                <div key={i} className="flex animate-pulse gap-4 px-5 py-5 sm:px-6">
                  <div className="h-12 w-12 shrink-0 rounded-md bg-[var(--enterprise-border)]" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="h-4 w-48 max-w-full rounded bg-[var(--enterprise-border)]" />
                    <div className="h-3 w-64 max-w-full rounded bg-[var(--enterprise-hover-surface)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : emailInvites.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]">
                <Mail className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--enterprise-text)]">
                No email invites yet
              </p>
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Send one from the Invite member tab or your project team page.
              </p>
            </div>
          ) : filteredEmailInvites.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                No invites match your filters
              </p>
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Try another type, status, or search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInviteListKindFilter("all");
                  setInviteListStatusFilter("all");
                  setInviteListSearch("");
                }}
                className="mt-4 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--enterprise-border)]">
              {filteredEmailInvites.map(
                // fallow-ignore-next-line complexity
                (inv) => {
                  const expired = !inv.acceptedAt && isExpired(inv);
                  const canAct = isAdmin && !inv.acceptedAt && !expired;
                  const editingThisInvite = editingInviteId === inv.id;
                  const rowKind = inviteRowKind(inv);
                  return (
                    <li
                      key={`email-${inv.id}`}
                      className="flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-[var(--enterprise-bg)] sm:px-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[var(--enterprise-primary-soft)] to-[var(--enterprise-primary-soft)] text-sm font-bold text-[var(--enterprise-primary-deep)]">
                            {inviteInitials(inv)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[15px] font-semibold text-[var(--enterprise-text)]">
                                {inv.inviteeName?.trim() || inv.email}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${inviteKindBadgeClass(rowKind)}`}
                              >
                                {pendingInviteKindLabel(inv)}
                              </span>
                              {inv.acceptedAt ? (
                                <span className="shrink-0 rounded-full bg-[var(--enterprise-semantic-success-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-success-text)] ring-1 ring-emerald-200/80">
                                  Joined
                                </span>
                              ) : expired ? (
                                <span className="shrink-0 rounded-full bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-danger-text)] ring-1 ring-red-200/80">
                                  Expired
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full bg-[var(--enterprise-semantic-warning-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-warning-text)] ring-1 ring-amber-200/80">
                                  Pending
                                </span>
                              )}
                            </div>
                            {inv.inviteeName?.trim() ? (
                              <p className="mt-0.5 truncate text-sm text-[var(--enterprise-text-muted)]">
                                {inv.email}
                              </p>
                            ) : null}
                            {inv.inviteeCompany?.trim() ? (
                              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                                {inv.inviteeCompany.trim()}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                              <span className="font-medium text-[var(--enterprise-subtitle)]">
                                {formatInviteSentAgo(inv.createdAt)}
                              </span>
                              {" · "}
                              Expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </p>
                            <p className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
                              <span className="font-medium text-[var(--enterprise-subtitle)]">
                                Projects:
                              </span>{" "}
                              {inv.projects.length > 0
                                ? inv.projects.map((p) => p.name).join(", ")
                                : "Full workspace"}
                              {inv.trade?.trim() ? (
                                <>
                                  {" · "}
                                  <span className="font-medium text-[var(--enterprise-subtitle)]">
                                    Trade:
                                  </span>{" "}
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
                              className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)]"
                            >
                              {editingThisInvite ? "Close" : "Edit projects"}
                            </button>
                            <button
                              type="button"
                              onClick={() => resendMutation.mutate(inv.id)}
                              disabled={resendMutation.isPending}
                              className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)] disabled:opacity-50"
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              onClick={() => revokeEmailMutation.mutate(inv.id)}
                              disabled={revokeEmailMutation.isPending}
                              className="rounded-md px-3 py-2 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] hover:bg-red-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {canAct && editingThisInvite ? (
                        <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-4">
                          <p className="mb-2 text-xs text-[var(--enterprise-text-muted)]">
                            Changes apply to this pending invite. Resend the email so they see the
                            updated project list.
                          </p>
                          {projectOptions.length === 0 ? (
                            <p className="text-sm text-[var(--enterprise-text-muted)]">
                              No projects in workspace.
                            </p>
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
                              className="rounded-md bg-[var(--enterprise-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50"
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
                              className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                },
              )}
            </ul>
          )}
        </div>
      ) : null}

      {isAdmin && variant === "inviteOnly" ? (
        <div id="invite-section" className="space-y-5">
          <div className="enterprise-card overflow-hidden">
            <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-border)]"
                  aria-hidden
                >
                  <UserPlus className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                    Invite member
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                    Invite by email
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
                    Send a branded invite — they get a link to join. Manage seats and pending
                    invites on the{" "}
                    <Link
                      href="/organization?tab=people"
                      className="font-medium text-[var(--enterprise-primary)] hover:underline"
                    >
                      People
                    </Link>{" "}
                    tab.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3 sm:px-6">
              <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
                <Users
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                  aria-hidden
                />
                <span>
                  Internal invites use seats. Clients and contractors are scoped to projects.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
                <Mail
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                  aria-hidden
                />
                <span>Links expire in 14 days. Resend or cancel anytime from People.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
                <Crown
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                  aria-hidden
                />
                <span>Only Super Admins can invite other Super Admins.</span>
              </div>
            </div>
          </div>

          <div className="enterprise-card p-4 sm:p-5">
            <EnterpriseForm form={inviteForm} onSubmit={onInvite} className="space-y-5">
              <EnterpriseFormField<WorkspaceInviteValues>
                name="email"
                label="Email address"
                required
              >
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseInput
                    {...field}
                    id={id}
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    placeholder="colleague@company.com"
                  />
                )}
              </EnterpriseFormField>

              <EnterpriseFormField<WorkspaceInviteValues>
                name="inviteKind"
                label="Invite as"
                hint={INVITE_KIND_HELP[inviteKind]}
              >
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
                <EnterpriseFormField<WorkspaceInviteValues>
                  name="role"
                  label="Workspace role"
                  hint={ROLE_HELP[role]}
                >
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
                <EnterpriseFormField<WorkspaceInviteValues> name="trade" label="Trade / discipline">
                  {({ describedBy, field, id, invalid }) => (
                    <EnterpriseInput
                      {...field}
                      id={id}
                      autoComplete="off"
                      maxLength={120}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      placeholder="e.g. Electrical, Concrete"
                    />
                  )}
                </EnterpriseFormField>
              ) : null}

              {inviteKind !== "INTERNAL" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <EnterpriseFormField<WorkspaceInviteValues>
                    name="inviteeName"
                    label="Invitee name"
                  >
                    {({ describedBy, field, id, invalid }) => (
                      <EnterpriseInput
                        {...field}
                        id={id}
                        autoComplete="off"
                        maxLength={200}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        placeholder="First Last"
                      />
                    )}
                  </EnterpriseFormField>
                  <EnterpriseFormField<WorkspaceInviteValues> name="inviteeCompany" label="Company">
                    {({ describedBy, field, id, invalid }) => (
                      <EnterpriseInput
                        {...field}
                        id={id}
                        autoComplete="off"
                        maxLength={200}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        placeholder="Company name"
                      />
                    )}
                  </EnterpriseFormField>
                </div>
              ) : null}

              <EnterpriseFormField<WorkspaceInviteValues> name="projectIds" label="Grant access to">
                {() => (
                  <>
                    {projectOptions.length === 0 ? (
                      <p className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 py-4 text-sm text-[var(--enterprise-text-muted)]">
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
                    <p className="mt-2 text-[13px] text-[var(--enterprise-text-muted)]">
                      {inviteKind === "INTERNAL" ? (
                        <>
                          Leave none selected for{" "}
                          <span className="font-medium text-[var(--enterprise-text)]">
                            Full workspace
                          </span>{" "}
                          — or pick one or more projects to limit access.
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-[var(--enterprise-text)]">
                            Required:
                          </span>{" "}
                          select one or more projects. External invites cannot use “full workspace”
                          without a project list.
                        </>
                      )}
                    </p>
                  </>
                )}
              </EnterpriseFormField>

              {error ? (
                <p className="text-sm text-[var(--enterprise-semantic-danger-text)]">{error}</p>
              ) : null}

              <div className="flex justify-end pt-2">
                <EnterpriseButton type="submit" size="lg" loading={sending}>
                  {sending ? (
                    "Sending…"
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send invite
                      <ArrowRight className="h-4 w-4 opacity-90" />
                    </>
                  )}
                </EnterpriseButton>
              </div>
            </EnterpriseForm>
          </div>
        </div>
      ) : null}
    </div>
  );
}

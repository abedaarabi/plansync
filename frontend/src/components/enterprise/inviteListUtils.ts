import type { EmailInviteKind, EmailInviteRow } from "@/lib/api-client";

export function formatInviteSentAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent yesterday";
  return `Sent ${days} days ago`;
}

export type InviteStatusFilter = "all" | "pending" | "expired" | "joined";
export type InviteKindFilter = "all" | EmailInviteKind;

export function inviteRowKind(inv: EmailInviteRow): EmailInviteKind {
  return inv.inviteKind ?? "INTERNAL";
}

export function pendingInviteKindLabel(inv: EmailInviteRow): string {
  const kind = inviteRowKind(inv);
  if (kind === "CLIENT") return "Client";
  if (kind === "CONTRACTOR") return "Contractor";
  if (kind === "SUBCONTRACTOR") return "Subcontractor";
  if (inv.role === "SUPER_ADMIN") return "Super Admin";
  if (inv.role === "ADMIN") return "Admin";
  return "Member";
}

export function inviteKindBadgeClass(kind: EmailInviteKind): string {
  switch (kind) {
    case "CLIENT":
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
    case "CONTRACTOR":
      return "bg-orange-50 text-orange-800 ring-1 ring-orange-200/80";
    case "SUBCONTRACTOR":
      return "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  }
}

export function inviteInitials(inv: EmailInviteRow): string {
  const name = inv.inviteeName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = inv.email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

export function filterEmailInvites(
  invites: EmailInviteRow[],
  opts: {
    kind: InviteKindFilter;
    status: InviteStatusFilter;
    search: string;
  },
  isExpiredFn: (inv: EmailInviteRow) => boolean,
): EmailInviteRow[] {
  const q = opts.search.trim().toLowerCase();
  return invites.filter((inv) => {
    if (opts.kind !== "all" && inviteRowKind(inv) !== opts.kind) return false;

    const expired = !inv.acceptedAt && isExpiredFn(inv);
    if (opts.status === "pending" && (inv.acceptedAt || expired)) return false;
    if (opts.status === "expired" && (!expired || Boolean(inv.acceptedAt))) return false;
    if (opts.status === "joined" && !inv.acceptedAt) return false;

    if (!q) return true;
    const hay = [
      inv.email,
      inv.inviteeName,
      inv.inviteeCompany,
      inv.trade,
      ...(inv.projects?.map((p) => p.name) ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

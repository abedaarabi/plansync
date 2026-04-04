"use client";

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-500/15 text-amber-600 ring-amber-500/25",
  ADMIN: "bg-blue-600/10 text-blue-700 ring-blue-600/20",
  MEMBER: "bg-slate-500/10 text-slate-600 ring-slate-500/20",
  CLIENT: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
  CONTRACTOR: "bg-orange-500/10 text-orange-700 ring-orange-500/20",
  SUBCONTRACTOR: "bg-slate-600/10 text-slate-700 ring-slate-600/20",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
  CLIENT: "Client",
  CONTRACTOR: "Contractor",
  SUBCONTRACTOR: "Sub-Contractor",
};

type RoleKey = "SUPER_ADMIN" | "ADMIN" | "MEMBER" | "CLIENT" | "CONTRACTOR" | "SUBCONTRACTOR";

export function RoleBadge({ role }: { role: string }) {
  const key = role as RoleKey;
  const cls = ROLE_STYLES[key] ?? ROLE_STYLES.MEMBER;
  const label = ROLE_LABELS[key] ?? role;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

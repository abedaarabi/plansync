"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import type { OmInspectionRunRow } from "@/lib/api-client";
import { formatOmWhen } from "@/lib/formatOmWhen";
import { OmAssigneeAvatar } from "@/components/enterprise/OmAssigneePicker";

function inspectionStatus(r: OmInspectionRunRow): {
  label: string;
  enterpriseClass: string;
  bimClass: string;
} {
  if (r.status.toUpperCase() === "DRAFT") {
    return {
      label: "Open",
      enterpriseClass: "enterprise-badge-warning",
      bimClass:
        "border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)] text-[var(--bim-text-muted)]",
    };
  }
  const deficient =
    Array.isArray(r.resultJson) &&
    r.resultJson.some((x) => (x as { outcome?: string })?.outcome === "fail");
  if (deficient) {
    return {
      label: "Deficient",
      enterpriseClass: "enterprise-badge-danger",
      bimClass: "border-red-400/40 bg-red-500/15 text-red-200",
    };
  }
  return {
    label: "Conforming",
    enterpriseClass: "enterprise-badge-success",
    bimClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  };
}

type Props = {
  runs: OmInspectionRunRow[];
  /** enterprise = O&M slides; bim = 3D glass dock */
  tone?: "enterprise" | "bim";
  limit?: number;
  emptyLabel?: string;
  /** When set, template name links here (list page). */
  inspectionsHref?: string | null;
  onNavigate?: () => void;
};

export function OmAssetInspectionTimeline({
  runs,
  tone = "enterprise",
  limit = 10,
  emptyLabel = "No inspections linked to this asset yet.",
  inspectionsHref,
  onNavigate,
}: Props) {
  const isBim = tone === "bim";
  const items = runs.slice(0, limit);

  if (items.length === 0) {
    return (
      <p
        className={
          isBim
            ? "text-[12px] text-[var(--bim-text-muted)]"
            : "text-[13px] text-[var(--enterprise-text-muted)]"
        }
      >
        {emptyLabel}
      </p>
    );
  }

  const lineClass = isBim ? "bg-[var(--bim-chrome-border)]" : "bg-[var(--enterprise-border)]";
  const titleClass = isBim
    ? "text-[12px] font-semibold text-[var(--bim-text)]"
    : "text-[13px] font-semibold text-[var(--enterprise-text)]";
  const metaClass = isBim
    ? "text-[10px] text-[var(--bim-text-muted)]"
    : "text-[11px] text-[var(--enterprise-text-muted)]";
  const linkClass = isBim
    ? "text-[12px] font-semibold text-[var(--bim-accent)] hover:underline"
    : "text-[13px] font-semibold text-[var(--enterprise-primary)] hover:underline";

  return (
    <ol className="relative ms-3 space-y-0 border-s border-transparent ps-0">
      {items.map((r, i) => {
        const status = inspectionStatus(r);
        const who = r.createdBy;
        const when = formatOmWhen(r.completedAt ?? r.updatedAt);
        const name = who?.name?.trim() || who?.email?.trim() || "Unknown";
        const isLast = i === items.length - 1;
        const title = r.template?.name?.trim() || "Inspection";

        return (
          <li key={r.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                className={`absolute start-[15px] top-8 bottom-0 w-px ${lineClass}`}
                aria-hidden
              />
            ) : null}
            <div className="relative z-[1] shrink-0 pt-0.5">
              {who ? (
                <OmAssigneeAvatar member={who} sizeClass="h-8 w-8" textClass="text-[10px]" />
              ) : (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    isBim
                      ? "border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_50%,transparent)] text-[var(--bim-text-muted)]"
                      : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]"
                  }`}
                  aria-hidden
                >
                  <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {inspectionsHref ? (
                  <Link href={inspectionsHref} onClick={onNavigate} className={linkClass}>
                    {title}
                  </Link>
                ) : (
                  <p className={titleClass}>{title}</p>
                )}
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold ${
                    isBim ? `rounded-md border ${status.bimClass}` : status.enterpriseClass
                  }`}
                >
                  {status.label}
                </span>
              </div>
              <p className={`mt-0.5 ${metaClass}`}>
                <span className="font-medium">{name}</span>
                <span aria-hidden> · </span>
                <span className="tabular-nums">{when}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CHANGE_REQUESTED: "Change requested",
};

const BADGE_BASE = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium";

export function proposalStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export function proposalStatusBadgeClass(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return `${BADGE_BASE} enterprise-badge-success`;
    case "DECLINED":
      return `${BADGE_BASE} border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]`;
    case "EXPIRED":
    case "CHANGE_REQUESTED":
      return `${BADGE_BASE} enterprise-badge-warning`;
    case "SENT":
      return `${BADGE_BASE} border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] text-[var(--enterprise-semantic-info-text)]`;
    case "VIEWED":
      return `${BADGE_BASE} border border-[color-mix(in_srgb,var(--enterprise-primary)_25%,var(--enterprise-border))] bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]`;
    case "DRAFT":
    default:
      return `${BADGE_BASE} enterprise-badge-neutral`;
  }
}

export function proposalStatusColor(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "var(--enterprise-semantic-success-text)";
    case "SENT":
      return "var(--enterprise-primary)";
    case "VIEWED":
      return "color-mix(in srgb, var(--enterprise-primary) 70%, #7c3aed)";
    case "CHANGE_REQUESTED":
      return "var(--enterprise-semantic-warning-text)";
    case "DECLINED":
      return "var(--enterprise-semantic-danger-text)";
    case "EXPIRED":
      return "var(--enterprise-semantic-warning-text)";
    case "DRAFT":
    default:
      return "var(--enterprise-text-muted)";
  }
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Link2,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  downloadOccupantAssetQrCsv,
  fetchIssuesForProject,
  fetchOccupantTokens,
  fetchRevokedOccupantTokens,
  ProRequiredError,
  type IssueRow,
} from "@/lib/api-client";
import { ISSUE_STATUS_LABEL, issueStatusBadgeClassLight } from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = { projectId: string };

// Scan/open analytics for popular assets: deferred until event logging and retention policy exist.

/** Occupant hub: activity snapshot, shortcuts, and building-entry link summary. Full link management lives in project settings. */
export function OmTenantPortalClient({ projectId }: Props) {
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id ?? null;
  const projectBase = wid ? `/workspaces/${wid}/projects/${projectId}` : `/projects/${projectId}`;
  const assetsHref = `${projectBase}/om/assets`;
  const inboxHref = `${projectBase}/om/tenant-requests`;
  const settingsHref = `${projectBase}/settings`;

  const {
    data: tokens = [],
    isPending: tokensPending,
    error: tokensError,
  } = useQuery({
    queryKey: qk.occupantTokens(projectId),
    queryFn: () => fetchOccupantTokens(projectId),
  });

  const { data: revoked = [] } = useQuery({
    queryKey: qk.occupantTokensRevoked(projectId),
    queryFn: () => fetchRevokedOccupantTokens(projectId),
    enabled: !tokensPending && !tokensError,
  });

  const issuesKey = qk.issuesForProject(projectId, undefined, "OCCUPANT", undefined);
  const {
    data: issues = [],
    isPending: issuesPending,
    error: issuesError,
  } = useQuery({
    queryKey: issuesKey,
    queryFn: () => fetchIssuesForProject(projectId, { issueKind: "OCCUPANT" }),
  });

  const { primaryToken } = useMemo(() => {
    const p = tokens[0];
    return { primaryToken: p, additionalTokens: p ? tokens.slice(1) : [] };
  }, [tokens]);

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status === "OPEN").length;
    const inProgress = issues.filter((i) => i.status === "IN_PROGRESS").length;
    return { open, inProgress, total: issues.length };
  }, [issues]);

  const recentIssues = useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [issues]);

  if (tokensPending) {
    return <EnterpriseLoadingState message="Loading occupant hub…" label="Loading" />;
  }

  if (tokensError) {
    return (
      <p className="text-sm text-red-600">
        {tokensError instanceof Error ? tokensError.message : "Could not load hub."}
      </p>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const primaryOccupantUrl = primaryToken ? `${origin}/occupant/${primaryToken.token}` : null;

  async function onDownloadCsv() {
    try {
      await downloadOccupantAssetQrCsv(projectId);
      toast.success("CSV downloaded.");
    } catch (e) {
      toast.error(
        e instanceof ProRequiredError ? "Pro subscription required." : (e as Error).message,
      );
    }
  }

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={LayoutDashboard}
        title="Occupant hub"
        description={
          <>
            Submissions and building entry links. Triage in inbox; QR codes on{" "}
            <Link
              href={assetsHref}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Assets
            </Link>
            .
          </>
        }
        action={
          <Link
            href={inboxHref}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Inbox className="h-3.5 w-3.5" />
            Inbox
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />

      {/* Activity */}
      <section aria-labelledby="occupant-activity-heading" className="space-y-2">
        <h2
          id="occupant-activity-heading"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]"
        >
          Activity
        </h2>
        {issuesError ? (
          <p className="text-sm text-red-600">
            {issuesError instanceof Error ? issuesError.message : "Could not load requests."}
          </p>
        ) : issuesPending ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">Loading requests…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { label: "Open", value: stats.open, tone: "amber" as const },
                  { label: "In progress", value: stats.inProgress, tone: "sky" as const },
                  { label: "All", value: stats.total, tone: "neutral" as const },
                ] as const
              ).map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1.5 text-center"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    {card.label}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-[var(--enterprise-text)]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {recentIssues.length === 0 ? (
              <div className="enterprise-card rounded-2xl px-4 py-10 text-center text-sm text-[var(--enterprise-text-muted)]">
                No occupant requests yet. They will appear here when someone submits via your
                building or equipment links.
              </div>
            ) : (
              <>
                <ul className="space-y-2" aria-label="Recent occupant requests">
                  {recentIssues.map((issue) => (
                    <li key={issue.id}>
                      <IssueRowLink issue={issue} inboxHref={inboxHref} />
                    </li>
                  ))}
                </ul>
                <Link
                  href={inboxHref}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--enterprise-primary)] active:scale-[0.98]"
                >
                  View all in inbox
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </>
            )}
          </>
        )}
      </section>

      {/* Shortcuts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Shortcuts
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onDownloadCsv()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition active:scale-[0.98] hover:border-[var(--enterprise-primary)]/30"
          >
            <Download className="h-4 w-4 shrink-0" />
            Equipment QR CSV
          </button>
          {primaryOccupantUrl ? (
            <a
              href={primaryOccupantUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition active:scale-[0.98] hover:border-[var(--enterprise-primary)]/30"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Preview page
            </a>
          ) : null}
        </div>
      </section>

      {/* Audit + primary link */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Building entry URL
        </h2>
        {primaryToken ? (
          <div className="enterprise-card space-y-3 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-[var(--enterprise-text-muted)]">
                  Primary link active since{" "}
                  <time dateTime={primaryToken.createdAt}>
                    {new Date(primaryToken.createdAt).toLocaleString()}
                  </time>
                  . If this URL was leaked, add a new link in settings and revoke the old one.
                </p>
                {revoked.length > 0 ? (
                  <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
                    {revoked.length} revoked link{revoked.length === 1 ? "" : "s"} on record — see
                    settings for the full history.
                  </p>
                ) : null}
              </div>
              <Link
                href={settingsHref}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] transition active:scale-[0.98] hover:bg-[var(--enterprise-hover-surface)]"
              >
                <Link2 className="h-3.5 w-3.5" />
                Manage links
              </Link>
            </div>
            <p className="break-all font-mono text-xs text-[var(--enterprise-text-muted)]">
              {primaryOccupantUrl}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={async () => {
                  if (!primaryOccupantUrl) return;
                  try {
                    await navigator.clipboard.writeText(primaryOccupantUrl);
                    toast.success("Building URL copied.");
                  } catch {
                    toast.error("Could not copy.");
                  }
                }}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition active:scale-[0.98] hover:bg-[var(--enterprise-hover-surface)] sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                Copy URL
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="enterprise-card flex gap-4 p-4 sm:p-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
          aria-hidden
        >
          <QrCode className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={2} />
        </div>
        <div className="min-w-0 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          <p className="font-medium text-[var(--enterprise-text)]">How equipment binding works</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              <strong className="font-medium text-[var(--enterprise-text)]">Building link</strong>{" "}
              (above) identifies this project.
            </li>
            <li>
              On an <strong className="font-medium text-[var(--enterprise-text)]">asset</strong>,
              the occupant QR block uses the{" "}
              <strong className="font-medium text-[var(--enterprise-text)]">primary</strong> link by
              default; optional links are configured in settings. The app adds the asset secret (
              <code className="rounded bg-[var(--enterprise-surface)] px-1">?a=</code>).
            </li>
            <li>
              <strong className="font-medium text-[var(--enterprise-text)]">Copy</strong> on this
              page is only the building URL. For a device-specific link, use{" "}
              <Link
                href={assetsHref}
                className="font-medium text-[var(--enterprise-primary)] hover:underline"
              >
                Assets
              </Link>
              .
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function IssueRowLink({ issue, inboxHref }: { issue: IssueRow; inboxHref: string }) {
  const href = `${inboxHref}/${issue.id}`;
  const stLabel = ISSUE_STATUS_LABEL[issue.status] ?? issue.status;
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 shadow-[var(--enterprise-shadow-xs)] transition active:scale-[0.98] active:bg-[var(--enterprise-hover-surface)]/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[var(--enterprise-text)]">
          {issue.title}
        </p>
        <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
          {new Date(issue.createdAt).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${issueStatusBadgeClassLight(issue.status)}`}
      >
        {stLabel}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
    </Link>
  );
}

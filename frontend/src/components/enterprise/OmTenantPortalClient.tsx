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
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
            aria-hidden
          >
            <LayoutDashboard
              className="h-7 w-7 text-[var(--enterprise-primary)]"
              strokeWidth={1.5}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Occupant hub
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              Occupant submissions and building entry links for this project. Triage requests in the
              inbox; full equipment URLs and QR codes stay on{" "}
              <Link
                href={assetsHref}
                className="font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Assets
              </Link>
              . Rotate or add optional links in{" "}
              <Link
                href={settingsHref}
                className="font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                project settings
              </Link>
              .
            </p>
          </div>
        </div>
        <Link
          href={inboxHref}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] lg:w-auto"
        >
          <Inbox className="h-4 w-4" />
          Open occupant inbox
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {/* Activity */}
      <section aria-labelledby="occupant-activity-heading" className="space-y-4">
        <h2
          id="occupant-activity-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]"
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {(
                [
                  { label: "Open", value: stats.open, tone: "amber" as const },
                  { label: "In progress", value: stats.inProgress, tone: "sky" as const },
                  { label: "All requests", value: stats.total, tone: "neutral" as const },
                ] as const
              ).map((card) => (
                <div
                  key={card.label}
                  className="enterprise-card flex min-h-[5.5rem] flex-col justify-center gap-1 rounded-2xl border border-[var(--enterprise-border)] p-4 sm:min-h-0 sm:p-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    {card.label}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--enterprise-text)]">
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
              <div className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)]">
                <ul className="divide-y divide-[var(--enterprise-border)]">
                  {recentIssues.map((issue) => (
                    <li key={issue.id}>
                      <IssueRowLink issue={issue} inboxHref={inboxHref} />
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/50 px-3 py-3 sm:px-4">
                  <Link
                    href={inboxHref}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline sm:min-h-0 sm:w-auto sm:justify-start"
                  >
                    View all in inbox
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Shortcuts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Shortcuts
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void onDownloadCsv()}
            className="inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 sm:w-auto sm:min-w-[12rem]"
          >
            <Download className="h-4 w-4 shrink-0" />
            Download equipment QR CSV
          </button>
          {primaryOccupantUrl ? (
            <a
              href={primaryOccupantUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 sm:w-auto sm:min-w-[12rem]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Preview occupant page
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
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] sm:min-h-10"
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
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-sm font-semibold text-[var(--enterprise-text)]"
              >
                <Copy className="h-4 w-4" />
                Copy building URL
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
      className="flex flex-col gap-2 px-4 py-4 transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--enterprise-primary)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--enterprise-text)]">{issue.title}</p>
        <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
          {new Date(issue.createdAt).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>
      <span
        className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${issueStatusBadgeClassLight(issue.status)}`}
      >
        {stLabel}
      </span>
    </Link>
  );
}

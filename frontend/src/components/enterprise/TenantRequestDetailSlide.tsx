"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpCircle,
  ChevronRight,
  ExternalLink,
  Flag,
  ImageIcon,
  Loader2,
  MapPin,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetSummaryCard } from "@/components/enterprise/OmAssetSummaryCard";
import {
  presignReadIssueReferencePhoto,
  viewerHrefForIssue,
  type IssueReferencePhotoRow,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { OM_COMPACT_LABEL, OM_COMPACT_SELECT } from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";

function PhotoThumb({ issueId, photo }: { issueId: string; photo: IssueReferencePhotoRow }) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.issueRefPhotoReadUrl(issueId, photo.id),
    queryFn: () => presignReadIssueReferencePhoto(issueId, photo.id),
    staleTime: 60_000,
  });
  if (isPending || !url) {
    return (
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-[var(--enterprise-border)]/60" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL
    <img
      src={url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-lg border border-[var(--enterprise-border)] object-cover"
    />
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--enterprise-border)]/70 bg-[var(--enterprise-hover-surface)]/25 p-3.5">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

type Member = { userId: string; name: string | null; email: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workOrdersHref: string;
  issue: IssueRow | null;
  loading: boolean;
  promotedAway: boolean;
  canPromoteOccupant: boolean;
  members: Member[];
  patching: boolean;
  creatingWo: boolean;
  promoting: boolean;
  onPatch: (vars: {
    id: string;
    status?: string;
    assigneeId?: string | null;
    priority?: string;
  }) => void;
  onCreateWorkOrder: (id: string) => void;
  onPromoteInPlace: (id: string) => void;
};

// fallow-ignore-next-line complexity
export function TenantRequestDetailSlide({
  open,
  onClose,
  projectId,
  workOrdersHref,
  issue,
  loading,
  promotedAway,
  canPromoteOccupant,
  members,
  patching,
  creatingWo,
  promoting,
  onPatch,
  onCreateWorkOrder,
  onPromoteInPlace,
}: Props) {
  const photoCount = issue?.referencePhotos?.length ?? 0;
  const viewerHref = issue ? viewerHrefForIssue(issue) : null;
  const pri = issue?.priority ?? "MEDIUM";
  const busy = patching || creatingWo || promoting;
  const canCreateWo = Boolean(
    issue && canPromoteOccupant && issue.issueKind === "OCCUPANT" && !promotedAway,
  );

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="tenant-detail-title"
      overlayZClass="z-[100]"
      header={
        <SlideOverHeader
          icon={MapPin}
          titleId="tenant-detail-title"
          title={issue?.title ?? (loading ? "Loading…" : "Request")}
          description={
            issue?.createdAt
              ? new Date(issue.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : promotedAway
                ? "Work order"
                : "Occupant request"
          }
          meta={
            issue && !promotedAway ? (
              <>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${issueStatusBadgeClassLight(issue.status)}`}
                >
                  {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClassLight(pri)}`}
                >
                  <Flag className="h-3 w-3" aria-hidden />
                  {ISSUE_PRIORITY_LABEL[pri] ?? pri}
                </span>
              </>
            ) : undefined
          }
        />
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          {canCreateWo && issue ? (
            <div className="flex w-full gap-2">
              <EnterpriseButton
                className="flex-1"
                disabled={busy || !issue.assetId}
                loading={creatingWo}
                onClick={() => onCreateWorkOrder(issue.id)}
              >
                <ArrowUpCircle className="h-4 w-4" aria-hidden />
                Work order
              </EnterpriseButton>
              <EnterpriseButton
                variant="secondary"
                className="flex-1"
                disabled={busy}
                loading={promoting}
                onClick={() => onPromoteInPlace(issue.id)}
              >
                Promote
              </EnterpriseButton>
            </div>
          ) : null}
          <Link
            href={viewerHref ?? "#"}
            onClick={(e) => {
              if (!viewerHref) e.preventDefault();
            }}
            className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] ${
              !viewerHref ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <MapPin className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
            Open in viewer
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>
      }
    >
      {loading && !issue ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-[var(--enterprise-text-muted)]">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--enterprise-primary)]" aria-hidden />
          Loading…
        </div>
      ) : issue && promotedAway ? (
        <div className="space-y-3 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40 p-4 text-sm leading-relaxed text-[var(--enterprise-text)]">
          <p>
            Promoted to an internal <strong className="font-semibold">work order</strong> — tracked
            outside the occupant inbox.
          </p>
          <Link
            href={workOrdersHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--enterprise-primary)] underline-offset-2 hover:underline"
          >
            Open work orders
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : issue ? (
        <div className="enterprise-animate-in space-y-3.5 text-sm text-[var(--enterprise-text)]">
          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)]">
              {(issue.description ?? "").trim() || "—"}
            </p>
          </SectionCard>

          {photoCount > 0 ? (
            <SectionCard title="Photos" icon={ImageIcon}>
              <div className="flex flex-wrap gap-2">
                {issue.referencePhotos!.map((p) => (
                  <PhotoThumb key={p.id} issueId={issue.id} photo={p} />
                ))}
              </div>
            </SectionCard>
          ) : null}

          {issue.asset || issue.location?.trim() ? (
            <SectionCard title="Equipment" icon={MapPin}>
              {issue.asset ? (
                <OmAssetSummaryCard
                  showTitle={false}
                  className="space-y-3"
                  asset={issue.asset}
                  image={
                    issue.asset.hasImage
                      ? { mode: "auth", projectId, assetId: issue.asset.id }
                      : undefined
                  }
                  footer={
                    issue.location?.trim() ? (
                      <p className="border-t border-[var(--enterprise-border)] pt-3 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                          Report location
                        </span>
                        <span className="mt-0.5 block font-medium text-[var(--enterprise-text)]">
                          {issue.location.trim()}
                        </span>
                      </p>
                    ) : null
                  }
                />
              ) : (
                <p className="text-sm font-medium text-[var(--enterprise-text)]">
                  {issue.location!.trim()}
                </p>
              )}
            </SectionCard>
          ) : null}

          <SectionCard title="Reporter" icon={UserRound}>
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">
              {issue.reporterName?.trim() || "—"}
            </p>
            {issue.reporterEmail?.trim() ? (
              <a
                href={`mailto:${issue.reporterEmail.trim()}`}
                className="mt-0.5 block break-all text-sm text-[var(--enterprise-primary)] hover:underline"
              >
                {issue.reporterEmail.trim()}
              </a>
            ) : null}
          </SectionCard>

          <SectionCard title="Triage">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className={OM_COMPACT_LABEL}>Status</span>
                <select
                  value={issue.status}
                  onChange={(e) => onPatch({ id: issue.id, status: e.target.value })}
                  disabled={busy}
                  className={`${OM_COMPACT_SELECT} cursor-pointer text-sm font-semibold disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
                >
                  {ISSUE_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {ISSUE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={OM_COMPACT_LABEL}>Priority</span>
                <select
                  value={pri}
                  onChange={(e) => onPatch({ id: issue.id, priority: e.target.value })}
                  disabled={busy}
                  className={`${OM_COMPACT_SELECT} cursor-pointer text-sm font-semibold disabled:opacity-50`}
                >
                  {ISSUE_PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {ISSUE_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0 sm:col-span-2">
                <span className={OM_COMPACT_LABEL}>Assignee</span>
                <select
                  value={issue.assigneeId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatch({ id: issue.id, assigneeId: v === "" ? null : v });
                  }}
                  disabled={busy}
                  className={`${OM_COMPACT_SELECT} text-sm disabled:opacity-50`}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email || m.userId}
                    </option>
                  ))}
                </select>
              </label>
              {issue.dueDate ? (
                <div className="sm:col-span-2">
                  <span className={OM_COMPACT_LABEL}>Due</span>
                  <p className="text-sm tabular-nums font-medium">
                    {issueDateToInputValue(issue.dueDate)}
                  </p>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </EnterpriseSlideOver>
  );
}

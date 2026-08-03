/**
 * Page chrome around the issues list: header CTA, Pro/asset banners,
 * “Showing N of M” results line, and inline error banner.
 */

"use client";

import Link from "next/link";
import { FolderOpen, Lock, MapPin, Plus, RotateCcw, Wrench } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";

function IssuesHeaderAction({
  canCreate,
  ctxLoading,
  isPro,
  isWorkOrders,
  createLabel,
  projectId,
  onCreateClick,
}: {
  canCreate: boolean;
  ctxLoading: boolean;
  isPro: boolean;
  isWorkOrders: boolean;
  createLabel: string;
  projectId: string;
  onCreateClick: () => void;
}) {
  return (
    <>
      {canCreate ? (
        <EnterpriseButton
          size="sm"
          disabled={ctxLoading || !isPro}
          onClick={onCreateClick}
          className={isWorkOrders ? "bg-sky-600 hover:bg-sky-700" : undefined}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          {createLabel}
        </EnterpriseButton>
      ) : null}
      <Link
        href={isWorkOrders ? `/projects/${projectId}/om/assets` : `/projects/${projectId}/files`}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
      >
        {isWorkOrders ? (
          <Wrench className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <FolderOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        )}
        {isWorkOrders ? "Assets" : "Project files"}
      </Link>
    </>
  );
}

export function IssuesPageHeader({
  listTitle,
  isPending,
  total,
  listItemNoun,
  canCreate,
  ctxLoading,
  isPro,
  isWorkOrders,
  createLabel,
  projectId,
  onCreateClick,
}: {
  listTitle: string;
  isPending: boolean;
  total: number;
  listItemNoun: string;
  canCreate: boolean;
  ctxLoading: boolean;
  isPro: boolean;
  isWorkOrders: boolean;
  createLabel: string;
  projectId: string;
  onCreateClick: () => void;
}) {
  return (
    <OmSubPageHeader
      icon={MapPin}
      title={listTitle}
      description={
        !isPending
          ? total === 0
            ? `No ${listTitle.toLowerCase()} recorded for this project yet.`
            : `${total} ${listItemNoun} in this project`
          : undefined
      }
      action={
        <IssuesHeaderAction
          canCreate={canCreate}
          ctxLoading={ctxLoading}
          isPro={isPro}
          isWorkOrders={isWorkOrders}
          createLabel={createLabel}
          projectId={projectId}
          onCreateClick={onCreateClick}
        />
      }
    />
  );
}

export function IssuesTopBanners({
  showProGate,
  listItemNoun,
  filterAssetId,
  clearAssetFilterHref,
}: {
  showProGate: boolean;
  listItemNoun: string;
  filterAssetId?: string;
  clearAssetFilterHref: string | null;
}) {
  if (!showProGate && !filterAssetId) return null;
  return (
    <>
      {showProGate ? (
        <div className="enterprise-alert-info flex items-start gap-3 px-4 py-3 shadow-[var(--enterprise-shadow-xs)]">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]"
            aria-hidden
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <p className="text-sm leading-relaxed">
            Pro subscription required to create and manage {listItemNoun}.
          </p>
        </div>
      ) : null}
      {filterAssetId ? (
        <div className="enterprise-card flex flex-wrap items-center justify-between gap-3 border border-[var(--enterprise-primary)]/30 bg-[var(--enterprise-primary-soft)] px-4 py-3 text-sm">
          <p className="text-[var(--enterprise-text)]">
            Showing {listItemNoun} linked to one asset.
          </p>
          {clearAssetFilterHref ? (
            <Link
              href={clearAssetFilterHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35"
            >
              <RotateCcw className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
              Show all
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function IssuesResultsLine({
  show,
  filteredCount,
  totalCount,
  listItemNoun,
  filtersActive,
  patchPending,
}: {
  show: boolean;
  filteredCount: number;
  totalCount: number;
  listItemNoun: string;
  filtersActive: boolean;
  patchPending: boolean;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--enterprise-text-muted)]">
      <p>
        Showing{" "}
        <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
          {filteredCount}
        </span>
        {filteredCount !== totalCount ? (
          <>
            {" "}
            of{" "}
            <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
              {totalCount}
            </span>
          </>
        ) : null}{" "}
        {listItemNoun}
        {filtersActive ? (
          <span className="text-[var(--enterprise-text-muted)]"> (filtered)</span>
        ) : null}
      </p>
      {patchPending ? (
        <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
          Updating status…
        </span>
      ) : null}
    </div>
  );
}

export function IssuesMsgBanner({ msg, onDismiss }: { msg: string | null; onDismiss: () => void }) {
  if (!msg) return null;
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      <span className="min-w-0 flex-1 leading-relaxed">{msg}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-900/80 underline-offset-2 hover:bg-red-100/60 hover:text-red-950 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

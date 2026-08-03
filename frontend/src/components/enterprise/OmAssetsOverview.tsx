"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ImageIcon,
  ImageOff,
  Link2,
  MapPin,
  Package,
  Tags,
} from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  computeOmAssetsOverview,
  type OmAssetCountSegment,
  type OmAssetsListFilter,
  type OmAssetsOverviewStats,
} from "@/lib/omAssetsOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
} as const;

function OverviewCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="enterprise-card flex min-w-0 flex-col p-4">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {title}
      </h3>
      <div className="mt-3 min-w-0 flex-1">{children}</div>
    </section>
  );
}

function SegmentBar({
  segments,
  onSelect,
  label,
}: {
  segments: OmAssetCountSegment[];
  onSelect?: (key: string) => void;
  label: string;
}) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  return (
    <div
      className="w-full rounded-lg bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
      role={onSelect ? "group" : "img"}
      aria-label={`${label}, ${total} total`}
    >
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-md">
        {segments.map((s) => {
          const selectable = onSelect && s.key !== "CAT:__other__";
          if (selectable) {
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(s.key)}
                className="min-h-full min-w-1 rounded-sm p-0 transition-opacity hover:opacity-75"
                style={{ flexGrow: s.count, backgroundColor: s.fill }}
                title={`${s.label}: ${s.count} — filter list`}
                aria-label={`Filter by ${s.label} (${s.count})`}
              />
            );
          }
          return (
            <div
              key={s.key}
              className="min-h-full min-w-1 rounded-sm"
              style={{ flexGrow: s.count, backgroundColor: s.fill }}
              title={`${s.label}: ${s.count}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function SegmentLegend({
  segments,
  onSelect,
  activeKey,
}: {
  segments: OmAssetCountSegment[];
  onSelect?: (key: string) => void;
  activeKey?: string;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
      {segments.map((s) => {
        const selectable = onSelect && s.key !== "CAT:__other__";
        const active = activeKey === s.key;
        const inner = (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ backgroundColor: s.fill }}
              aria-hidden
            />
            {s.label}{" "}
            <span className="tabular-nums font-semibold text-[var(--enterprise-text)]">
              {s.count}
            </span>
          </>
        );
        if (!selectable) {
          return (
            <li
              key={s.key}
              className="inline-flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-[var(--enterprise-text-muted)]"
            >
              {inner}
            </li>
          );
        }
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] ${
                active
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)]"
                  : "text-[var(--enterprise-text-muted)]"
              }`}
            >
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function KpiRow({
  stats,
  filter,
  onSelect,
}: {
  stats: OmAssetsOverviewStats;
  filter: OmAssetsListFilter;
  onSelect: (key: OmAssetsListFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
      <EnterpriseOverviewKpiTile
        label="Total"
        value={stats.total}
        borderClass={KPI_BORDER.primary}
        active={filter === "ALL"}
        onClick={() => onSelect("ALL")}
      />
      <EnterpriseOverviewKpiTile
        label="With photo"
        value={stats.withPhoto}
        borderClass={KPI_BORDER.success}
        active={filter === "WITH_PHOTO"}
        onClick={() => onSelect("WITH_PHOTO")}
      />
      <EnterpriseOverviewKpiTile
        label="Missing photo"
        value={stats.missingPhoto}
        borderClass={stats.missingPhoto > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
        active={filter === "MISSING_PHOTO"}
        onClick={() => onSelect("MISSING_PHOTO")}
      />
      <EnterpriseOverviewKpiTile
        label="On drawing"
        value={stats.onDrawing}
        borderClass={KPI_BORDER.primary}
        active={filter === "ON_DRAWING"}
        onClick={() => onSelect("ON_DRAWING")}
      />
      <EnterpriseOverviewKpiTile
        label="Linked"
        value={stats.linked}
        borderClass={KPI_BORDER.neutral}
        active={filter === "LINKED"}
        onClick={() => onSelect("LINKED")}
      />
      <EnterpriseOverviewKpiTile
        label="Warranty ≤ 90d"
        value={stats.warrantyExpiring}
        borderClass={stats.warrantyExpiring > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
        hint="Expires within 90 days or already expired"
        active={filter === "WARRANTY_EXPIRING"}
        onClick={() => onSelect("WARRANTY_EXPIRING")}
      />
    </div>
  );
}

type Props = {
  rows: OmAssetRow[];
  filter: OmAssetsListFilter;
  onFilterChange: (key: OmAssetsListFilter) => void;
  /** When search is active, counts reflect the search result set. */
  searchActive?: boolean;
};

export function OmAssetsOverview({ rows, filter, onFilterChange, searchActive }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(() => computeOmAssetsOverview(rows, nowMs), [rows, nowMs]);
  const [open, setOpen] = useState(true);

  if (stats.total === 0) return null;

  const selectFilter = (key: string) => {
    if (key === "CAT:__other__") return;
    onFilterChange(key as OmAssetsListFilter);
  };

  return (
    <section aria-label="Assets overview" className="space-y-3">
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
          Overview
          {searchActive ? " · matching search" : ""}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <div className={`${open ? "block" : "hidden"} space-y-3 sm:block`}>
        {searchActive ? (
          <p className="hidden text-xs text-[var(--enterprise-text-muted)] sm:block">
            Overview counts reflect the current search results.
          </p>
        ) : null}

        <KpiRow stats={stats} filter={filter} onSelect={onFilterChange} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <OverviewCard title="Link status" icon={Link2}>
            <SegmentBar
              segments={stats.linkSegments}
              onSelect={selectFilter}
              label="Link status distribution"
            />
            <SegmentLegend
              segments={stats.linkSegments}
              onSelect={selectFilter}
              activeKey={filter}
            />
          </OverviewCard>
          <OverviewCard title="Top categories" icon={Tags}>
            {stats.categorySegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">No categories yet.</p>
            ) : (
              <>
                <SegmentBar
                  segments={stats.categorySegments}
                  onSelect={selectFilter}
                  label="Category distribution"
                />
                <SegmentLegend
                  segments={stats.categorySegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </OverviewCard>
        </div>

        {filter !== "ALL" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <FilterHintIcon filter={filter} />
              Showing filtered register
            </span>
            <button
              type="button"
              onClick={() => onFilterChange("ALL")}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilterHintIcon({ filter }: { filter: OmAssetsListFilter }) {
  if (filter === "WITH_PHOTO") return <ImageIcon className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "MISSING_PHOTO") return <ImageOff className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "ON_DRAWING") return <MapPin className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "LINKED") return <Link2 className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "WARRANTY_EXPIRING") return <AlertTriangle className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "BIM") return <Boxes className="h-3.5 w-3.5" aria-hidden />;
  return <Package className="h-3.5 w-3.5" aria-hidden />;
}

"use client";

import { useMemo, useState } from "react";
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
import { EnterpriseOverviewCard } from "@/components/enterprise/EnterpriseOverviewCard";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  OverviewSegmentBar,
  OverviewSegmentLegend,
} from "@/components/enterprise/EnterpriseOverviewSegments";
import {
  computeOmAssetsOverview,
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

const NON_SELECTABLE_CAT = ["CAT:__other__"] as const;

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
          <EnterpriseOverviewCard title="Link status" icon={Link2}>
            <OverviewSegmentBar
              segments={stats.linkSegments}
              onSelect={selectFilter}
              label="Link status distribution"
            />
            <OverviewSegmentLegend
              segments={stats.linkSegments}
              onSelect={selectFilter}
              activeKey={filter}
            />
          </EnterpriseOverviewCard>
          <EnterpriseOverviewCard title="Top categories" icon={Tags}>
            {stats.categorySegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">No categories yet.</p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.categorySegments}
                  onSelect={selectFilter}
                  label="Category distribution"
                  nonSelectableKeys={NON_SELECTABLE_CAT}
                />
                <OverviewSegmentLegend
                  segments={stats.categorySegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                  nonSelectableKeys={NON_SELECTABLE_CAT}
                />
              </>
            )}
          </EnterpriseOverviewCard>
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

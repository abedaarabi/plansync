"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChartPie,
  FileText,
  HardDrive,
  ImageIcon,
  Layers,
  MessageSquare,
  Tags,
} from "lucide-react";
import type { Project } from "@/types/projects";
import { EnterpriseOverviewCard } from "@/components/enterprise/EnterpriseOverviewCard";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  OverviewSegmentBar,
  OverviewSegmentLegend,
} from "@/components/enterprise/EnterpriseOverviewSegments";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { formatBytes } from "@/components/file-explorer/fileExplorerUtils";
import {
  computeFilesOverview,
  type FilesOverviewFilter,
  type FilesOverviewStats,
} from "@/lib/filesOverviewStats";

const INSIGHTS_OPEN_KEY = "plansync.filesInsightsOpen";
const INSIGHTS_SEEN_KEY = "plansync.filesInsightsSeen";
const NON_SELECTABLE_DISC = ["DISC:__other__"] as const;

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  info: "border-l-[var(--enterprise-semantic-info-text)]",
} as const;

function KpiRow({
  stats,
  filter,
  onSelect,
}: {
  stats: FilesOverviewStats;
  filter: FilesOverviewFilter;
  onSelect: (key: FilesOverviewFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      <EnterpriseOverviewKpiTile
        label="Files"
        value={stats.totalFiles}
        borderClass={KPI_BORDER.primary}
        hint={`${stats.folders} folder${stats.folders === 1 ? "" : "s"}`}
        active={filter === "ALL"}
        onClick={() => onSelect("ALL")}
      />
      <EnterpriseOverviewKpiTile
        label="PDFs"
        value={stats.pdfs}
        borderClass={KPI_BORDER.primary}
        active={filter === "PDF"}
        onClick={() => onSelect("PDF")}
      />
      <EnterpriseOverviewKpiTile
        label="IFC / BIM"
        value={stats.ifcs}
        borderClass={KPI_BORDER.success}
        active={filter === "IFC"}
        onClick={() => onSelect("IFC")}
      />
      <EnterpriseOverviewKpiTile
        label="Images"
        value={stats.images}
        borderClass={KPI_BORDER.warning}
        active={filter === "IMAGE"}
        onClick={() => onSelect("IMAGE")}
      />
      <EnterpriseOverviewKpiTile
        label="Multi-version"
        value={stats.multiVersion}
        borderClass={KPI_BORDER.info}
        active={filter === "MULTI_VERSION"}
        onClick={() => onSelect("MULTI_VERSION")}
      />
      <EnterpriseOverviewKpiTile
        label="With comments"
        value={stats.withComments}
        borderClass={stats.withComments > 0 ? KPI_BORDER.info : KPI_BORDER.neutral}
        active={filter === "WITH_COMMENTS"}
        onClick={() => onSelect("WITH_COMMENTS")}
      />
    </div>
  );
}

function StorageDonut({
  usedBytes,
  quotaBytes,
  projectBytes,
  warn,
}: {
  usedBytes: number;
  quotaBytes: number;
  projectBytes: number;
  warn: boolean;
}) {
  const pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const stroke = warn ? "var(--enterprise-semantic-warning-text)" : "var(--enterprise-primary)";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[72px] w-[72px] shrink-0" aria-hidden>
        <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="var(--enterprise-border)"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-[stroke-dasharray] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-[var(--enterprise-text)]">
            {Math.round(pct)}%
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            used
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
          {formatBytes(usedBytes)}
          <span className="font-normal text-[var(--enterprise-text-muted)]">
            {" "}
            / {formatBytes(quotaBytes)}
          </span>
        </p>
        <p className="text-[11px] text-[var(--enterprise-text-muted)]">Workspace storage</p>
        {projectBytes > 0 ? (
          <p className="text-[11px] text-[var(--enterprise-text-muted)]">
            This project ·{" "}
            <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
              {formatBytes(projectBytes)}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function QuickFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition ${
        active
          ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
          : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
      }`}
    >
      {label}
    </button>
  );
}

type Props = {
  project: Project;
  filter: FilesOverviewFilter;
  onFilterChange: (key: FilesOverviewFilter) => void;
  /** Workspace storage from `/me` — when set, shows used-space donut. */
  storageUsedBytes?: number;
  storageQuotaBytes?: number;
};

// fallow-ignore-next-line complexity
export function FilesOverview({
  project,
  filter,
  onFilterChange,
  storageUsedBytes,
  storageQuotaBytes,
}: Props) {
  const stats = useMemo(() => computeFilesOverview(project), [project]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  /** null until hydrated — avoid flashing the “new” badge incorrectly. */
  const [insightsSeen, setInsightsSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setInsightsSeen(localStorage.getItem(INSIGHTS_SEEN_KEY) === "1");
      if (sessionStorage.getItem(INSIGHTS_OPEN_KEY) === "1") setInsightsOpen(true);
    } catch {
      setInsightsSeen(true);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(INSIGHTS_OPEN_KEY, insightsOpen ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [insightsOpen]);

  if (stats.totalFiles === 0 && stats.folders === 0) return null;

  const openInsights = () => {
    setInsightsOpen(true);
    if (insightsSeen !== true) {
      setInsightsSeen(true);
      try {
        localStorage.setItem(INSIGHTS_SEEN_KEY, "1");
      } catch {
        /* private mode */
      }
    }
  };

  const selectFilter = (key: string) => {
    if (key === "DISC:__other__") return;
    onFilterChange(key as FilesOverviewFilter);
    setInsightsOpen(false);
  };

  const showStorage =
    storageQuotaBytes != null &&
    storageQuotaBytes > 0 &&
    storageUsedBytes != null &&
    Number.isFinite(storageUsedBytes);
  const storagePct =
    showStorage && storageQuotaBytes! > 0 ? (storageUsedBytes! / storageQuotaBytes!) * 100 : 0;
  const insightsHint = showStorage
    ? `${Math.round(storagePct)}% storage`
    : `${stats.totalFiles} file${stats.totalFiles === 1 ? "" : "s"}`;

  return (
    <section aria-label="Files overview" className="mb-2 shrink-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {filter !== "ALL" ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <FilterHintIcon filter={filter} />
              Filtered across project
            </span>
            <button
              type="button"
              onClick={() => onFilterChange("ALL")}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--enterprise-text-muted)]">
            {stats.totalFiles} file{stats.totalFiles === 1 ? "" : "s"} · {stats.folders} folder
            {stats.folders === 1 ? "" : "s"}
          </span>
        )}
        <button
          type="button"
          onClick={openInsights}
          className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-xs font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)]"
        >
          <ChartPie className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" aria-hidden />
          Insights
          <span className="tabular-nums text-[var(--enterprise-text-muted)]">· {insightsHint}</span>
          {insightsSeen === false ? (
            <span
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--enterprise-primary)] ring-2 ring-[var(--enterprise-bg)]"
              aria-label="New"
            />
          ) : null}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <QuickFilterChip
          label={`PDFs · ${stats.pdfs}`}
          active={filter === "PDF"}
          onClick={() => onFilterChange(filter === "PDF" ? "ALL" : "PDF")}
        />
        <QuickFilterChip
          label={`IFC · ${stats.ifcs}`}
          active={filter === "IFC"}
          onClick={() => onFilterChange(filter === "IFC" ? "ALL" : "IFC")}
        />
        <QuickFilterChip
          label={`Comments · ${stats.withComments}`}
          active={filter === "WITH_COMMENTS"}
          onClick={() => onFilterChange(filter === "WITH_COMMENTS" ? "ALL" : "WITH_COMMENTS")}
        />
      </div>

      <EnterpriseSlideOver
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        ariaLabelledBy="files-insights-title"
        panelMaxWidthClass="max-w-full lg:w-[35vw] lg:max-w-[35vw]"
        header={
          <div className="min-w-0">
            <h2
              id="files-insights-title"
              className="truncate text-base font-semibold text-[var(--enterprise-text)]"
            >
              Files insights
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
              Filters, charts, and storage
            </p>
          </div>
        }
        footer={
          <button
            type="button"
            onClick={() => setInsightsOpen(false)}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] lg:w-auto"
          >
            Done
          </button>
        }
      >
        <div className="space-y-3">
          <KpiRow stats={stats} filter={filter} onSelect={selectFilter} />
          <EnterpriseOverviewCard compact title="File types" icon={Layers}>
            {stats.kindSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">No files yet.</p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.kindSegments}
                  onSelect={selectFilter}
                  label="File type distribution"
                />
                <OverviewSegmentLegend
                  segments={stats.kindSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </EnterpriseOverviewCard>
          <EnterpriseOverviewCard compact title="Disciplines" icon={Tags}>
            {stats.disciplineSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">
                No disciplines tagged yet.
              </p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.disciplineSegments}
                  onSelect={selectFilter}
                  label="Discipline distribution"
                  nonSelectableKeys={NON_SELECTABLE_DISC}
                />
                <OverviewSegmentLegend
                  segments={stats.disciplineSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                  nonSelectableKeys={NON_SELECTABLE_DISC}
                />
              </>
            )}
          </EnterpriseOverviewCard>
          {showStorage || stats.totalBytes > 0 ? (
            <EnterpriseOverviewCard compact title="Used space" icon={HardDrive}>
              {showStorage ? (
                <StorageDonut
                  usedBytes={storageUsedBytes!}
                  quotaBytes={storageQuotaBytes!}
                  projectBytes={stats.totalBytes}
                  warn={storagePct >= 85}
                />
              ) : (
                <p className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {formatBytes(stats.totalBytes)}
                  <span className="ml-1 text-[11px] font-normal text-[var(--enterprise-text-muted)]">
                    in this project
                  </span>
                </p>
              )}
            </EnterpriseOverviewCard>
          ) : null}
        </div>
      </EnterpriseSlideOver>
    </section>
  );
}

function FilterHintIcon({ filter }: { filter: FilesOverviewFilter }) {
  if (filter === "PDF") return <FileText className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "IFC" || filter === "BIM_PUBLISHED") {
    return <Boxes className="h-3.5 w-3.5" aria-hidden />;
  }
  if (filter === "IMAGE") return <ImageIcon className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "WITH_COMMENTS") return <MessageSquare className="h-3.5 w-3.5" aria-hidden />;
  if (filter.startsWith("DISC:")) return <Tags className="h-3.5 w-3.5" aria-hidden />;
  return <Layers className="h-3.5 w-3.5" aria-hidden />;
}

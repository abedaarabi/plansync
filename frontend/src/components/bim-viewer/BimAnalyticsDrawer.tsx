"use client";

import { useMemo, useState } from "react";
import { BarChart3, Layers3, Shapes, X } from "lucide-react";
import type { BimQuantityIndex } from "@/lib/bim/types";
import { bimIndexBlockingLoad } from "@/lib/bim/indexStatus";
import {
  buildAnalyticsSnapshot,
  formatQuantity,
  segmentIsFullySelected,
  type BimChartSegment,
} from "@/lib/bim/chartStats";

type AnalyticsTab = "overview" | "types" | "levels" | "disciplines";

// fallow-ignore-next-line complexity
export function BimAnalyticsDrawer(props: {
  index: BimQuantityIndex | null;
  selectedGuids: Set<string>;
  conversionStatus: string;
  onSelectSegment: (segment: BimChartSegment) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const snapshot = useMemo(() => buildAnalyticsSnapshot(props.index), [props.index]);

  const blocking = bimIndexBlockingLoad(props.conversionStatus, props.index, null);

  return (
    <div
      className="bim-analytics-drawer bim-glass-surface"
      role="dialog"
      aria-label="Model analytics"
    >
      <div className="bim-analytics-drawer__header">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-[var(--bim-accent)]" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[var(--bim-chrome-text)]">
              Model analytics
            </p>
            <p className="truncate text-[10px] text-[var(--bim-chrome-text-muted)]">
              Tap a bar to select and zoom in the 3D view
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close analytics"
          className="bim-bottom-search-panel__close"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {!snapshot ? (
        <p className="bim-bottom-search-panel__hint">
          {blocking
            ? "Quantity index is building… charts appear when metadata is ready."
            : "No index data yet."}
        </p>
      ) : (
        <>
          <div className="bim-analytics-drawer__tabs" role="tablist" aria-label="Analytics views">
            <TabBtn
              active={tab === "overview"}
              label="Overview"
              onClick={() => setTab("overview")}
            />
            <TabBtn active={tab === "types"} label="Types" onClick={() => setTab("types")} />
            <TabBtn active={tab === "levels"} label="Levels" onClick={() => setTab("levels")} />
            <TabBtn
              active={tab === "disciplines"}
              label="Disciplines"
              onClick={() => setTab("disciplines")}
            />
          </div>

          <div className="bim-analytics-drawer__body">
            {tab === "overview" ? (
              <OverviewTab
                snapshot={snapshot}
                selectedGuids={props.selectedGuids}
                onSelect={props.onSelectSegment}
              />
            ) : null}
            {tab === "types" ? (
              <ChartList
                title="Elements by IFC type"
                subtitle="Top types in this model"
                icon={Shapes}
                segments={snapshot.topTypes}
                metric="count"
                selectedGuids={props.selectedGuids}
                onSelect={props.onSelectSegment}
              />
            ) : null}
            {tab === "levels" ? (
              <ChartList
                title="Elements by level"
                subtitle="Storeys / building levels"
                icon={Layers3}
                segments={snapshot.topLevels}
                metric="count"
                selectedGuids={props.selectedGuids}
                onSelect={props.onSelectSegment}
              />
            ) : null}
            {tab === "disciplines" ? (
              <ChartList
                title="Elements by discipline"
                subtitle="Architectural, structural, MEP…"
                icon={BarChart3}
                segments={snapshot.disciplines}
                metric="count"
                selectedGuids={props.selectedGuids}
                onSelect={props.onSelectSegment}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      data-active={props.active ? "true" : undefined}
      onClick={props.onClick}
      className="bim-analytics-drawer__tab"
    >
      {props.label}
    </button>
  );
}

function OverviewTab(props: {
  snapshot: NonNullable<ReturnType<typeof buildAnalyticsSnapshot>>;
  selectedGuids: Set<string>;
  onSelect: (segment: BimChartSegment) => void;
}) {
  const { snapshot } = props;
  return (
    <div className="space-y-4">
      <div className="bim-analytics-kpi-grid">
        <KpiCard label="Elements" value={snapshot.totalElements.toLocaleString()} />
        <KpiCard label="IFC types" value={String(snapshot.typeCount)} />
        <KpiCard label="Levels" value={String(snapshot.levelCount)} />
        <KpiCard
          label="Indexed area"
          value={
            snapshot.totalArea != null ? formatQuantity(snapshot.totalArea, "m²") : "Not in export"
          }
        />
      </div>

      {snapshot.loqQuantitiesPct != null ? (
        <p className="text-[10px] leading-relaxed text-[var(--bim-chrome-text-muted)]">
          {Math.round(snapshot.loqQuantitiesPct)}% of elements include quantity data in this IFC.
          Area and volume charts depend on how the model was exported.
        </p>
      ) : null}

      <ChartList
        title="Top element types"
        subtitle="Click to highlight in the viewer"
        icon={Shapes}
        segments={snapshot.topTypes.slice(0, 6)}
        metric="count"
        selectedGuids={props.selectedGuids}
        onSelect={props.onSelect}
        compact
      />

      {snapshot.topTypes.some((s) => s.totalArea != null) ? (
        <ChartList
          title="Largest areas by type"
          subtitle="Where QTO / base quantities exist"
          icon={BarChart3}
          segments={[...snapshot.topTypes]
            .filter((s) => s.totalArea != null && s.totalArea > 0)
            .sort((a, b) => (b.totalArea ?? 0) - (a.totalArea ?? 0))
            .slice(0, 6)}
          metric="area"
          selectedGuids={props.selectedGuids}
          onSelect={props.onSelect}
          compact
        />
      ) : null}
    </div>
  );
}

function KpiCard(props: { label: string; value: string }) {
  return (
    <div className="bim-analytics-kpi">
      <p className="bim-analytics-kpi__label">{props.label}</p>
      <p className="bim-analytics-kpi__value">{props.value}</p>
    </div>
  );
}

function ChartList(props: {
  title: string;
  subtitle: string;
  icon: typeof Shapes;
  segments: BimChartSegment[];
  metric: "count" | "area" | "volume";
  selectedGuids: Set<string>;
  onSelect: (segment: BimChartSegment) => void;
  compact?: boolean;
}) {
  const Icon = props.icon;
  // fallow-ignore-next-line complexity
  const max = useMemo(() => {
    let m = 0;
    for (const s of props.segments) {
      const v =
        props.metric === "area"
          ? (s.totalArea ?? 0)
          : props.metric === "volume"
            ? (s.totalVolume ?? 0)
            : s.count;
      if (v > m) m = v;
    }
    return m || 1;
  }, [props.metric, props.segments]);

  if (props.segments.length === 0) {
    return (
      <p className="text-[11px] text-[var(--bim-chrome-text-muted)]">No data for this breakdown.</p>
    );
  }

  return (
    <section className={props.compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--bim-chrome-text)]">{props.title}</p>
          <p className="text-[10px] text-[var(--bim-chrome-text-muted)]">{props.subtitle}</p>
        </div>
      </div>
      <ul className="space-y-1.5" aria-label={props.title}>
        {props.segments.map(
          // fallow-ignore-next-line complexity
          (segment) => {
            const value =
              props.metric === "area"
                ? segment.totalArea
                : props.metric === "volume"
                  ? segment.totalVolume
                  : segment.count;
            const pct = Math.max(4, Math.round(((value ?? 0) / max) * 100));
            const selected = segmentIsFullySelected(segment, props.selectedGuids);
            const valueLabel =
              props.metric === "area" && segment.totalArea != null
                ? formatQuantity(segment.totalArea, "m²")
                : props.metric === "volume" && segment.totalVolume != null
                  ? formatQuantity(segment.totalVolume, "m³")
                  : segment.count.toLocaleString();

            return (
              <li key={`${segment.kind}-${segment.id}`}>
                <button
                  type="button"
                  onClick={() => props.onSelect(segment)}
                  data-selected={selected ? "true" : undefined}
                  className="bim-analytics-bar"
                  aria-label={`${segment.label}, ${valueLabel}. Select and zoom.`}
                >
                  <span className="bim-analytics-bar__label">{segment.label}</span>
                  <span className="bim-analytics-bar__track" aria-hidden>
                    <span className="bim-analytics-bar__fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="bim-analytics-bar__value">{valueLabel}</span>
                </button>
              </li>
            );
          },
        )}
      </ul>
    </section>
  );
}

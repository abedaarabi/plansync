"use client";

import {
  AlertCircle,
  BarChart3,
  Loader2,
  Palette,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { resolveAuthoredColorPct } from "@/lib/bim/loqHelpers";
import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";
import { BIM_GEOMETRY_PROFILE } from "@/lib/bim/renderingProfile";
import {
  BIM_COLOR_MODE_OPTIONS,
  BIM_ENVIRONMENT_OPTIONS,
  BIM_FOG_MODE_OPTIONS,
  BIM_GRID_MODE_OPTIONS,
  BIM_SPACE_DISPLAY_OPTIONS,
  type BimViewportAppearance,
} from "@/lib/bim/viewportAppearance";

// fallow-ignore-next-line complexity
export function BimModelQualityPanel(props: {
  loq: BimLoqReport | null;
  quantityIndex: BimQuantityIndex | null;
  conversionStatus: string;
  appearance: BimViewportAppearance;
  onAppearanceChange: (patch: Partial<BimViewportAppearance>) => void;
  onRebuildIndex?: () => void;
}) {
  const building =
    !props.loq && (props.conversionStatus === "pending" || props.conversionStatus === "running");
  const failed = !props.loq && props.conversionStatus === "failed";
  const authoredColorPct = resolveAuthoredColorPct(props.loq, props.quantityIndex);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
          <BarChart3 className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="bim-section-title">Model quality</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
            Data coverage, viewport appearance, and export guidance.
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
          <p className="text-[11px] font-semibold text-[var(--bim-text)]">Viewport appearance</p>
        </div>

        <p className="mb-3 text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
          Settings are saved in this browser and restored when you reopen the viewer.
        </p>
        <div className="space-y-3">
          <AppearanceSelect
            label="Environment"
            value={props.appearance.environment}
            options={BIM_ENVIRONMENT_OPTIONS}
            onChange={(environment) => props.onAppearanceChange({ environment })}
          />
          <AppearanceSelect
            label="Element colors"
            value={props.appearance.colorMode}
            options={BIM_COLOR_MODE_OPTIONS}
            onChange={(colorMode) => props.onAppearanceChange({ colorMode })}
          />
          <AppearanceSelect
            label="Space display"
            value={props.appearance.spaceDisplay}
            options={BIM_SPACE_DISPLAY_OPTIONS}
            onChange={(spaceDisplay) => props.onAppearanceChange({ spaceDisplay })}
          />
          <AppearanceSelect
            label="Atmospheric fog"
            value={props.appearance.fogMode}
            options={BIM_FOG_MODE_OPTIONS}
            onChange={(fogMode) => props.onAppearanceChange({ fogMode })}
          />
          <AppearanceSelect
            label="Ground grid"
            value={props.appearance.gridMode}
            options={BIM_GRID_MODE_OPTIONS}
            onChange={(gridMode) => props.onAppearanceChange({ gridMode })}
          />
        </div>
      </div>

      {building ? (
        <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] px-3 py-4">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--bim-text)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--bim-accent)]" aria-hidden />
            Building quantity index…
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
            This runs once per model revision and powers search, quantities, and auto-map.
          </p>
        </div>
      ) : null}

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-red-900">Quantity index build failed</p>
              <p className="mt-1 text-[11px] text-red-800/80">
                Rebuild the index to restore search and takeoff features.
              </p>
              {props.onRebuildIndex ? (
                <button
                  type="button"
                  onClick={props.onRebuildIndex}
                  className="bim-btn-secondary mt-3 w-full justify-center py-2 text-[11px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rebuild index
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {props.loq ? (
        <LoqMetrics
          loq={props.loq}
          authoredColorPct={authoredColorPct}
          onRebuildIndex={props.onRebuildIndex}
        />
      ) : !building && !failed ? (
        <div className="space-y-3 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
          <CoverageBar label="Authored colors" pct={authoredColorPct} />
          <p className="text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
            Gray elements use discipline fallbacks until the quantity index finishes building.
          </p>
        </div>
      ) : null}

      {!building && !failed ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
              Geometry profile
            </p>
            <p className="mt-1 text-[12px] font-medium text-[var(--bim-text)]">
              {BIM_GEOMETRY_PROFILE}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
              Full tessellation, space boundaries, and double-sided materials.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--bim-border)] bg-slate-50/80 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
                Active rendering
              </p>
            </div>
            <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
              <li>PBR shading with type-based roughness and metalness</li>
              <li>Transparent layers sorted — glass and spaces render on top</li>
              <li>Selection highlight uses the app accent blue</li>
            </ul>
          </div>
        </div>
      ) : null}

      {!building && !failed && !props.loq && authoredColorPct === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--bim-text-muted)]">
          No quality report available yet.
        </p>
      ) : null}
    </div>
  );
}

function AppearanceSelect<T extends string>(props: {
  label: string;
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  const active = props.options.find((o) => o.id === props.value);

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-[var(--bim-text-muted)]">
        {props.label}
      </span>
      <select
        className="bim-select"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      {active?.hint ? (
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--bim-text-subtle)]">
          {active.hint}
        </p>
      ) : null}
    </label>
  );
}

function LoqMetrics(props: {
  loq: BimLoqReport;
  authoredColorPct: number;
  onRebuildIndex?: () => void;
}) {
  const { loq } = props;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Elements" value={loq.totalElements.toLocaleString()} />
        <StatCard label="Identity" value={`${loq.pctIdentity}%`} />
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
        <CoverageBar label="Quantities" pct={loq.pctQuantities} />
        <CoverageBar label="Materials" pct={loq.pctMaterial} />
        <CoverageBar label="Authored colors" pct={props.authoredColorPct} />
        <CoverageBar label="Levels" pct={loq.pctLevel} />
      </div>

      {loq.recommendedExportHints.length > 0 ? (
        <div className="rounded-lg border border-[var(--bim-border)] bg-slate-50/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
            Export recommendations
          </p>
          <ul className="mt-2 space-y-1.5">
            {loq.recommendedExportHints.map((hint) => (
              <li key={hint} className="text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
                {hint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.onRebuildIndex ? (
        <button
          type="button"
          onClick={props.onRebuildIndex}
          className="bim-btn-secondary w-full justify-center py-2 text-[11px]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rebuild index
        </button>
      ) : null}
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--bim-border)] px-3 py-2.5">
      <p className="text-[10px] text-[var(--bim-text-muted)]">{props.label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--bim-text)]">
        {props.value}
      </p>
    </div>
  );
}

function CoverageBar(props: { label: string; pct: number }) {
  const tone =
    props.pct >= 70 ? "bg-[var(--bim-accent)]" : props.pct >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-[var(--bim-text)]">{props.label}</span>
        <span className="tabular-nums text-[var(--bim-text-muted)]">{props.pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bim-border)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, props.pct))}%` }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  Gauge,
  Grid3X3,
  Keyboard,
  Loader2,
  Navigation2,
  Palette,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { BimKeyboardShortcutsPanel } from "./BimKeyboardShortcutsPanel";
import { resolveAuthoredColorPct } from "@/lib/bim/loqHelpers";
import { bimIndexBlockingLoad, bimIndexEnriching } from "@/lib/bim/indexStatus";
import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";
import { BIM_GEOMETRY_PROFILE } from "@/lib/bim/renderingProfile";
import {
  BIM_BACKGROUND_THEME_OPTIONS,
  BIM_COLOR_MODE_OPTIONS,
  BIM_EDGE_MODE_OPTIONS,
  BIM_ENVIRONMENT_OPTIONS,
  BIM_FOG_MODE_OPTIONS,
  BIM_GRID_MODE_OPTIONS,
  BIM_GRID_SPACING_OPTIONS,
  BIM_NAVIGATION_SPEED_OPTIONS,
  BIM_QUALITY_PRESET_OPTIONS,
  BIM_SPACE_DISPLAY_OPTIONS,
  type BimViewportAppearance,
} from "@/lib/bim/viewportAppearance";
import type { BimQualityState } from "@/lib/bim/renderQuality";

// fallow-ignore-next-line complexity
export function BimModelQualityPanel(props: {
  loq: BimLoqReport | null;
  quantityIndex: BimQuantityIndex | null;
  conversionStatus: string;
  appearance: BimViewportAppearance;
  qualityState: BimQualityState | null;
  onAppearanceChange: (patch: Partial<BimViewportAppearance>) => void;
  onRebuildIndex?: () => void;
}) {
  const [qualityTab, setQualityTab] = useState<"appearance" | "shortcuts">("appearance");
  const blocking = bimIndexBlockingLoad(props.conversionStatus, props.quantityIndex, props.loq);
  const enriching = bimIndexEnriching(props.conversionStatus, props.quantityIndex, props.loq);
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
            Data coverage, viewport appearance, keyboard shortcuts, and export guidance.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2.5">
          <div className="bim-segment bim-segment-compact">
            <QualityTabBtn
              active={qualityTab === "appearance"}
              label="Viewport appearance"
              icon={SlidersHorizontal}
              onClick={() => setQualityTab("appearance")}
            />
            <QualityTabBtn
              active={qualityTab === "shortcuts"}
              label="Keyboard shortcuts"
              icon={Keyboard}
              onClick={() => setQualityTab("shortcuts")}
            />
          </div>
        </div>

        {qualityTab === "appearance" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
                <p className="text-[11px] font-semibold text-[var(--bim-text)]">Appearance</p>
              </div>
              <div className="space-y-3">
                <AppearanceSelect
                  label="Background"
                  value={props.appearance.backgroundTheme}
                  options={BIM_BACKGROUND_THEME_OPTIONS}
                  onChange={(backgroundTheme) => props.onAppearanceChange({ backgroundTheme })}
                />
                <AppearanceSelect
                  label="Lighting environment"
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
              </div>
            </div>

            <div className="rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
              <div className="mb-3 flex items-center gap-2">
                <Navigation2 className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
                <p className="text-[11px] font-semibold text-[var(--bim-text)]">Navigation</p>
              </div>
              <AppearanceSelect
                label="Camera speed"
                value={props.appearance.navigationSpeed}
                options={BIM_NAVIGATION_SPEED_OPTIONS}
                onChange={(navigationSpeed) => props.onAppearanceChange({ navigationSpeed })}
              />
            </div>

            <div className="rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
                  <p className="text-[11px] font-semibold text-[var(--bim-text)]">Rendering</p>
                </div>
                {props.qualityState ? (
                  <span className="bim-quality-badge">{props.qualityState.effective}</span>
                ) : null}
              </div>
              {props.qualityState ? (
                <p className="mb-3 text-[10px] leading-relaxed text-[var(--bim-text-subtle)]">
                  {props.qualityState.reason}
                </p>
              ) : null}
              <div className="space-y-3">
                <AppearanceSelect
                  label="Quality preset"
                  value={props.appearance.qualityPreset}
                  options={BIM_QUALITY_PRESET_OPTIONS}
                  onChange={(qualityPreset) => props.onAppearanceChange({ qualityPreset })}
                />
                <ToggleRow
                  label="Ambient occlusion"
                  hint="Adds contact depth at intersections"
                  checked={props.appearance.ssaoEnabled}
                  onChange={(ssaoEnabled) => props.onAppearanceChange({ ssaoEnabled })}
                />
                <AppearanceSelect
                  label="Edge mode"
                  value={props.appearance.edgeMode}
                  options={BIM_EDGE_MODE_OPTIONS}
                  onChange={(edgeMode) => props.onAppearanceChange({ edgeMode })}
                />
                <AppearanceSelect
                  label="Atmospheric fog"
                  value={props.appearance.fogMode}
                  options={BIM_FOG_MODE_OPTIONS}
                  onChange={(fogMode) => props.onAppearanceChange({ fogMode })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
              <div className="mb-3 flex items-center gap-2">
                <Grid3X3 className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
                <p className="text-[11px] font-semibold text-[var(--bim-text)]">Engineering grid</p>
              </div>
              <div className="space-y-3">
                <AppearanceSelect
                  label="Visibility"
                  value={props.appearance.gridMode}
                  options={BIM_GRID_MODE_OPTIONS}
                  onChange={(gridMode) => props.onAppearanceChange({ gridMode })}
                />
                <AppearanceSelect
                  label="Spacing"
                  value={props.appearance.gridSpacing}
                  options={BIM_GRID_SPACING_OPTIONS}
                  onChange={(gridSpacing) => props.onAppearanceChange({ gridSpacing })}
                />
                <ToggleRow
                  label="Axis colors"
                  hint="Show restrained X and Z origin axes"
                  checked={props.appearance.gridAxes}
                  onChange={(gridAxes) => props.onAppearanceChange({ gridAxes })}
                />
              </div>
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-[var(--bim-text-subtle)]">
              Viewport settings are saved in this browser.
            </p>
          </div>
        ) : (
          <BimKeyboardShortcutsPanel />
        )}
      </div>

      {blocking ? (
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

      {enriching ? (
        <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-hover)] px-3 py-2.5 text-[11px] text-[var(--bim-text-muted)]">
          Detailed quantities are still loading. Charts and level coverage below are already
          available.
        </div>
      ) : null}

      {failed ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--bim-danger)_35%,var(--bim-border))] bg-[color-mix(in_srgb,var(--bim-danger)_10%,var(--bim-panel))] px-3 py-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bim-danger)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[var(--bim-text)]">
                Quantity index build failed
              </p>
              <p className="mt-1 text-[11px] text-[var(--bim-text-muted)]">
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
      ) : !blocking && !failed ? (
        <div className="space-y-3 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
          <CoverageBar label="Authored colors" pct={authoredColorPct} />
          <p className="text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
            Gray elements use discipline fallbacks until the quantity index finishes building.
          </p>
        </div>
      ) : null}

      {!blocking && !failed ? (
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
          <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-hover)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
                Active rendering
              </p>
            </div>
            <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
              <li>Matte PBR surfaces with type-based roughness and subtle micro-texture</li>
              <li>Transparent layers sorted — glass and spaces render on top</li>
              <li>Selection highlight uses the app accent blue</li>
            </ul>
          </div>
        </div>
      ) : null}

      {!blocking && !failed && !props.loq && authoredColorPct === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--bim-text-muted)]">
          No quality report available yet.
        </p>
      ) : null}
    </div>
  );
}

function QualityTabBtn(props: {
  active: boolean;
  label: string;
  icon: typeof SlidersHorizontal;
  onClick: () => void;
}) {
  const Icon = props.icon;

  return (
    <button
      type="button"
      onClick={props.onClick}
      data-active={props.active}
      className="bim-segment-btn inline-flex items-center justify-center gap-1 text-[10px]"
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {props.label}
    </button>
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

function ToggleRow(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[var(--bim-text-muted)]">{props.label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--bim-text-subtle)]">
          {props.hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
        data-state={props.checked ? "on" : "off"}
        onClick={() => props.onChange(!props.checked)}
        className="bim-render-toggle"
      >
        <span className="bim-render-toggle__thumb">
          {props.checked ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
        </span>
      </button>
    </div>
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
        <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-hover)] px-3 py-3">
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
    props.pct >= 70
      ? "bg-[var(--bim-accent)]"
      : props.pct >= 40
        ? "bg-[var(--bim-warning)]"
        : "bg-[var(--bim-danger)]";

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

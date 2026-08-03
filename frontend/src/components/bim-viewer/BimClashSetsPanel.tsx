"use client";

import { Eye, EyeOff, Loader2, Play, X } from "lucide-react";
import type { BimClashSetDef } from "@plansync/shared/bimClashTypes";
import {
  buildClashSetDef,
  displayModelLabel,
  ifcTypesFromSet,
  levelFromSet,
  modelIdFromSet,
} from "@/lib/bim/clash/clashSets";

type ModelOption = { modelId: string; name: string; visible: boolean };
type TypeOption = { ifcType: string; count: number };

const TYPE_PRESETS = 12;

function SetPicker(props: {
  label: string;
  accent: string;
  value: BimClashSetDef;
  models: ModelOption[];
  typeOptions: TypeOption[];
  levels: string[];
  onChange: (next: BimClashSetDef) => void;
  onToggleModelVisible: (modelId: string, visible: boolean) => void;
}) {
  const selectedModelId = modelIdFromSet(props.value);
  const selectedTypes = ifcTypesFromSet(props.value);
  const selectedLevel = levelFromSet(props.value);
  const selectedModel = props.models.find((m) => m.modelId === selectedModelId) ?? null;

  function commit(next: {
    modelId?: string;
    modelName?: string;
    ifcTypes?: string[];
    level?: string | null;
  }) {
    const modelId = next.modelId ?? selectedModelId;
    const modelName =
      next.modelName ??
      selectedModel?.name ??
      props.models.find((m) => m.modelId === modelId)?.name;
    if (!modelId || !modelName) return;
    props.onChange(
      buildClashSetDef({
        modelId,
        modelName,
        ifcTypes: next.ifcTypes ?? selectedTypes,
        level: next.level === undefined ? selectedLevel : next.level,
      }),
    );
  }

  function toggleType(ifcType: string) {
    const has = selectedTypes.includes(ifcType);
    const next = has ? selectedTypes.filter((t) => t !== ifcType) : [...selectedTypes, ifcType];
    commit({ ifcTypes: next });
  }

  const visibleTypes = props.typeOptions.slice(0, TYPE_PRESETS);

  return (
    <div
      className="bim-detail-card space-y-2 border-l-2 p-2.5"
      style={{ borderLeftColor: props.accent }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: props.accent }} aria-hidden />
        <p className="text-[11px] font-semibold text-[var(--bim-text)]">{props.label}</p>
      </div>

      {props.models.length === 0 ? (
        <p className="text-[10px] text-[var(--bim-text-muted)]">Load a model to choose a set.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-[var(--bim-text-muted)]">Model</p>
          {props.models.map((m) => {
            const active = selectedModelId === m.modelId;
            const label = displayModelLabel(m.name);
            return (
              <div key={m.modelId} className="flex items-start gap-1">
                <button
                  type="button"
                  title={label}
                  className={`bim-focus-ring min-h-9 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-[11px] leading-snug break-words [overflow-wrap:anywhere] ${
                    active
                      ? "bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
                      : "text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
                  }`}
                  onClick={() =>
                    commit({
                      modelId: m.modelId,
                      modelName: m.name,
                      ifcTypes: [],
                      level: null,
                    })
                  }
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="bim-focus-ring bim-rail-btn mt-0.5 h-8 w-8 shrink-0"
                  aria-label={m.visible ? `Hide ${label}` : `Show ${label}`}
                  onClick={() => props.onToggleModelVisible(m.modelId, !m.visible)}
                >
                  {m.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedModelId && visibleTypes.length > 0 ? (
        <div className="space-y-1.5 border-t border-[var(--bim-border)] pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium text-[var(--bim-text-muted)]">Element types</p>
            <button
              type="button"
              className={`bim-focus-ring rounded-md px-1.5 py-0.5 text-[10px] ${
                selectedTypes.length === 0
                  ? "bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
                  : "text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
              }`}
              onClick={() => commit({ ifcTypes: [] })}
            >
              All types
            </button>
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {visibleTypes.map((t) => {
              const active = selectedTypes.includes(t.ifcType);
              return (
                <label
                  key={t.ifcType}
                  className={`flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[11px] ${
                    active
                      ? "bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
                      : "text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-[var(--bim-border)]"
                    checked={active}
                    onChange={() => toggleType(t.ifcType)}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.ifcType.replace(/^Ifc/, "")}</span>
                  <span className="tabular-nums text-[10px] opacity-70">
                    {t.count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
          {props.typeOptions.length > TYPE_PRESETS ? (
            <p className="text-[9px] text-[var(--bim-text-subtle)]">
              Showing top {TYPE_PRESETS} of {props.typeOptions.length} types
            </p>
          ) : null}
        </div>
      ) : null}

      {props.levels.length > 0 ? (
        <div className="space-y-1 border-t border-[var(--bim-border)] pt-2">
          <p className="text-[10px] font-medium text-[var(--bim-text-muted)]">Level</p>
          <select
            className="bim-select w-full text-[11px]"
            value={selectedLevel ?? ""}
            onChange={(e) => commit({ level: e.target.value || null })}
          >
            <option value="">All levels</option>
            {props.levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function BimClashSetsPanel(props: {
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  setACount: number;
  setBCount: number;
  models: ModelOption[];
  typeOptionsA: TypeOption[];
  typeOptionsB: TypeOption[];
  levels: string[];
  clearanceEnabled: boolean;
  clearanceMm: number;
  running: boolean;
  progress: number | null;
  onChangeSetA: (set: BimClashSetDef) => void;
  onChangeSetB: (set: BimClashSetDef) => void;
  onToggleModelVisible: (modelId: string, visible: boolean) => void;
  onClearanceEnabledChange: (v: boolean) => void;
  onClearanceMmChange: (v: number) => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="bim-dock-scroll space-y-3 p-2.5">
        <p className="px-0.5 text-[10px] leading-snug text-[var(--bim-text-muted)]">
          Choose model A vs model B, then narrow by element type for large tests.
        </p>
        <SetPicker
          label="Set A"
          accent="var(--bim-accent)"
          value={props.setA}
          models={props.models}
          typeOptions={props.typeOptionsA}
          levels={props.levels}
          onChange={props.onChangeSetA}
          onToggleModelVisible={props.onToggleModelVisible}
        />
        <SetPicker
          label="Set B"
          accent="var(--bim-warning)"
          value={props.setB}
          models={props.models}
          typeOptions={props.typeOptionsB}
          levels={props.levels}
          onChange={props.onChangeSetB}
          onToggleModelVisible={props.onToggleModelVisible}
        />
        <div className="bim-detail-card space-y-2 p-2.5">
          <p className="text-[11px] font-semibold text-[var(--bim-text)]">Clearance</p>
          <label className="flex items-center gap-2 text-[11px] text-[var(--bim-text-muted)]">
            <input
              type="checkbox"
              className="rounded border-[var(--bim-border)]"
              checked={props.clearanceEnabled}
              disabled={props.running}
              onChange={(e) => props.onClearanceEnabledChange(e.target.checked)}
            />
            Soft clearance clashes
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[var(--bim-text-muted)]">
            <span className="w-16 shrink-0">Distance</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={props.clearanceMm}
              disabled={props.running || !props.clearanceEnabled}
              onChange={(e) => props.onClearanceMmChange(Number(e.target.value) || 0)}
              className="bim-select w-20 px-1.5 py-1 text-[11px]"
              aria-label="Clearance millimetres"
            />
            <span>mm</span>
          </label>
        </div>
      </div>
      <div className="shrink-0 border-t border-[var(--bim-border)] bg-[var(--bim-panel)] p-2.5">
        <p className="mb-2 text-[10px] leading-snug break-words [overflow-wrap:anywhere] text-[var(--bim-text-muted)]">
          <span className="font-medium text-[var(--bim-text)]">{props.setA.label}</span> (
          {props.setACount.toLocaleString()})
          <span className="mx-1" aria-hidden>
            vs
          </span>
          <span className="font-medium text-[var(--bim-text)]">{props.setB.label}</span> (
          {props.setBCount.toLocaleString()})
        </p>
        {props.running ? (
          <button
            type="button"
            className="bim-btn-secondary bim-focus-ring flex min-h-10 w-full items-center justify-center gap-1.5 text-[12px]"
            onClick={props.onCancel}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {props.progress != null ? `${Math.round(props.progress * 100)}%` : "Running"}
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="bim-btn-primary bim-focus-ring flex min-h-10 w-full items-center justify-center gap-1.5 text-[12px]"
            onClick={props.onRun}
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Run test
          </button>
        )}
      </div>
    </div>
  );
}

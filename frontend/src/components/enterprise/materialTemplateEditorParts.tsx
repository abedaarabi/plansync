"use client";

import { ChevronDown, ChevronUp, LayoutList, Plus, Sparkles, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { MaterialCustomFieldType, MaterialTemplateField } from "@/lib/api-client";

export const MAX_CUSTOM_MATERIAL_FIELDS = 20;

const FIELD_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition placeholder:text-[var(--enterprise-text-muted)]/45 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/15";

export type DraftField = MaterialTemplateField;

function fieldTypeBadgeClass(type: MaterialCustomFieldType): string {
  if (type === "text") return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (type === "number") return "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-200";
  return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200";
}

function fieldTypeLabel(type: MaterialCustomFieldType): string {
  if (type === "text") return "Text";
  if (type === "number") return "Number";
  return "Currency";
}

function previewCellValue(type: MaterialCustomFieldType): string {
  if (type === "number") return "12.5";
  if (type === "currency") return "0.00";
  return "—";
}

export function MaterialTemplateEditorHeader() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/15">
        <LayoutList className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h2
          id="material-template-title"
          className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
        >
          Catalog fields
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          Add columns such as CO₂, density, or certifications. They appear in the materials table,
          edit form, and Excel template for this workspace.
        </p>
      </div>
    </div>
  );
}

export function MaterialTemplateEditorFooter({
  onClose,
  saveMutation,
  isPending,
}: {
  onClose: () => void;
  saveMutation: UseMutationResult<unknown, Error, void, unknown>;
  isPending: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={saveMutation.isPending || isPending}
        onClick={() => saveMutation.mutate()}
        className="rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
      >
        {saveMutation.isPending ? "Saving…" : "Save template"}
      </button>
    </>
  );
}

function MaterialTemplateLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 py-14 text-sm text-[var(--enterprise-text-muted)]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--enterprise-primary-soft)]" />
      Loading field template…
    </div>
  );
}

function MaterialTemplateToolbar({
  fieldCount,
  onAddField,
}: {
  fieldCount: number;
  onAddField: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-3">
      <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
        <span className="font-medium text-[var(--enterprise-text)]">{fieldCount}</span> of{" "}
        {MAX_CUSTOM_MATERIAL_FIELDS} fields · Keys stay stable for API and Excel imports
      </p>
      <button
        type="button"
        onClick={onAddField}
        disabled={fieldCount >= MAX_CUSTOM_MATERIAL_FIELDS}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add field
      </button>
    </div>
  );
}

function MaterialTemplateEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-6 py-12 text-center shadow-[var(--enterprise-shadow-xs)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
        <Sparkles className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--enterprise-text)]">No custom fields yet</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
        Extend the catalog beyond the default columns—environmental data, certifications, lead time,
        and more.
      </p>
    </div>
  );
}

function MaterialTemplateFieldRow({
  field,
  index,
  fieldCount,
  onMove,
  onRemove,
  onChange,
}: {
  field: DraftField;
  index: number;
  fieldCount: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<DraftField>) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--enterprise-border)] border-l-[3px] border-l-[var(--enterprise-primary)] bg-[var(--enterprise-surface)] py-4 pl-1 pr-3 shadow-[var(--enterprise-shadow-xs)] ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
      <div className="flex flex-wrap items-start gap-3 pl-2">
        <div className="flex shrink-0 flex-col gap-0.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 p-0.5">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-25"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === fieldCount - 1}
            onClick={() => onMove(index, 1)}
            className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-25"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-[2.25rem] min-w-0 flex-1 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-bg)] text-[11px] font-bold tabular-nums text-[var(--enterprise-text-muted)]">
            {index + 1}
          </span>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Label
                </label>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${fieldTypeBadgeClass(field.type)}`}
                >
                  {fieldTypeLabel(field.type)}
                </span>
                {field.required ? (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                    Required
                  </span>
                ) : null}
              </div>
              <input
                value={field.label}
                onChange={(e) => onChange(index, { label: e.target.value })}
                className={FIELD_INPUT_CLASS}
                placeholder="e.g. CO₂ (kg/m³)"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Key (slug)
              </label>
              <input
                value={field.key}
                onChange={(e) =>
                  onChange(index, {
                    key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  })
                }
                className={`${FIELD_INPUT_CLASS} font-mono text-xs`}
                placeholder="co2_kg_m3"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Value type
              </label>
              <select
                value={field.type}
                onChange={(e) =>
                  onChange(index, { type: e.target.value as MaterialCustomFieldType })
                }
                className={FIELD_INPUT_CLASS}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="currency">Currency amount</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-1 py-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange(index, { required: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--enterprise-border)] text-[var(--enterprise-primary)] focus:ring-[var(--enterprise-primary)]/20"
              />
              <span className="text-sm text-[var(--enterprise-text)]">
                Required when saving a material
              </span>
            </label>
          </div>
        </div>
        <button
          type="button"
          aria-label="Remove field"
          onClick={() => onRemove(index)}
          className="shrink-0 rounded-xl p-2.5 text-[var(--enterprise-text-muted)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MaterialTemplateFieldList({
  draft,
  onMove,
  onRemove,
  onChange,
}: {
  draft: DraftField[];
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<DraftField>) => void;
}) {
  if (draft.length === 0) return <MaterialTemplateEmptyState />;

  return (
    <>
      {draft.map((f, index) => (
        <MaterialTemplateFieldRow
          key={f.id}
          field={f}
          index={index}
          fieldCount={draft.length}
          onMove={onMove}
          onRemove={onRemove}
          onChange={onChange}
        />
      ))}
    </>
  );
}

function MaterialTemplateTablePreview({ fields }: { fields: DraftField[] }) {
  if (fields.length === 0) return null;

  return (
    <div className="border-t border-[var(--enterprise-border)] pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        Table preview
      </p>
      <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
        Column order matches the list above (plus fixed core columns on the real grid).
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--enterprise-border)] shadow-[var(--enterprise-shadow-xs)]">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80">
              <th className="px-3 py-2.5 font-semibold text-[var(--enterprise-text-muted)]">
                Type
              </th>
              <th className="px-3 py-2.5 font-semibold text-[var(--enterprise-text-muted)]">
                Material
              </th>
              {fields.map((col) => (
                <th
                  key={col.id}
                  className="bg-[var(--enterprise-primary-soft)]/35 px-3 py-2.5 font-semibold text-[var(--enterprise-primary)]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--enterprise-surface)] text-[var(--enterprise-text)]">
            <tr className="border-b border-[var(--enterprise-border)]/50">
              <td className="px-3 py-2.5 text-[var(--enterprise-text-muted)]">Concrete</td>
              <td className="px-3 py-2.5">Sample mix</td>
              {fields.map((col) => (
                <td
                  key={col.id}
                  className="bg-[var(--enterprise-primary-soft)]/15 px-3 py-2.5 tabular-nums text-[var(--enterprise-text-muted)]"
                >
                  {previewCellValue(col.type)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MaterialTemplateEditorBody({
  showLoading,
  draft,
  onAddField,
  onMove,
  onRemove,
  onChange,
}: {
  showLoading: boolean;
  draft: DraftField[];
  onAddField: () => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<DraftField>) => void;
}) {
  if (showLoading) return <MaterialTemplateLoadingState />;

  return (
    <>
      <MaterialTemplateToolbar fieldCount={draft.length} onAddField={onAddField} />
      <div className="space-y-3">
        <MaterialTemplateFieldList
          draft={draft}
          onMove={onMove}
          onRemove={onRemove}
          onChange={onChange}
        />
      </div>
      <MaterialTemplateTablePreview fields={draft} />
    </>
  );
}

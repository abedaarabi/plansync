"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LayoutList, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMaterialTemplate,
  patchMaterialTemplate,
  type MaterialCustomFieldType,
  type MaterialTemplate,
  type MaterialTemplateField,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";

export const MAX_CUSTOM_MATERIAL_FIELDS = 20;

function slugFromLabel(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 63);
  if (/^[a-z][a-z0-9_]{0,62}$/.test(s)) return s;
  return `field_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

type DraftField = MaterialTemplateField;

export function MaterialTemplateEditor({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: qk.materialTemplate(workspaceId),
    queryFn: () => fetchMaterialTemplate(workspaceId),
    enabled: open && Boolean(workspaceId),
  });

  const [draft, setDraft] = useState<DraftField[]>([]);

  useEffect(() => {
    if (!open || !data) return;
    setDraft(
      [...data.fields].sort(
        (a, b) =>
          a.order - b.order || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    );
  }, [open, data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields = draft.map((f, i) => ({ ...f, order: i }));
      const template: MaterialTemplate = {
        version: data?.version ?? 1,
        fields,
      };
      return patchMaterialTemplate(workspaceId, template);
    },
    onSuccess: () => {
      toast.success("Catalog fields saved");
      void queryClient.invalidateQueries({ queryKey: qk.materialTemplate(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: qk.materials(workspaceId) });
      void queryClient.invalidateQueries({
        queryKey: ["materialsPaged", workspaceId],
        exact: false,
      });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Visual column order matches the list (reorder updates array, not `order` until save). */
  const previewFields = draft;

  function addField() {
    if (draft.length >= MAX_CUSTOM_MATERIAL_FIELDS) {
      toast.message(`Maximum ${MAX_CUSTOM_MATERIAL_FIELDS} custom fields`);
      return;
    }
    const label = `New field ${draft.length + 1}`;
    setDraft((d) => [
      ...d,
      {
        id: crypto.randomUUID(),
        key: slugFromLabel(label),
        label,
        type: "text" as MaterialCustomFieldType,
        required: false,
        order: d.length,
      },
    ]);
  }

  function moveField(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= draft.length) return;
    setDraft((rows) => {
      const copy = [...rows];
      const [x] = copy.splice(index, 1);
      if (x) copy.splice(next, 0, x);
      return copy;
    });
  }

  function removeField(index: number) {
    const f = draft[index];
    if (
      !f ||
      !confirm(
        `Remove “${f.label}”? Existing materials may still store values for key “${f.key}”; they stay in the database but won’t show until you add a field with the same key again.`,
      )
    ) {
      return;
    }
    setDraft((rows) => rows.filter((_, i) => i !== index));
  }

  const fieldInputClass =
    "mt-1 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition placeholder:text-[var(--enterprise-text-muted)]/45 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/15";

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="material-template-title"
      panelMaxWidthClass="max-w-2xl"
      bodyClassName="px-5 py-6"
      header={
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
              Add columns such as CO₂, density, or certifications. They appear in the materials
              table, edit form, and Excel template for this workspace.
            </p>
          </div>
        </div>
      }
      footer={
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
      }
    >
      <div className="space-y-6">
        {open && isPending && !data ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 py-14 text-sm text-[var(--enterprise-text-muted)]">
            <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--enterprise-primary-soft)]" />
            Loading field template…
          </div>
        ) : null}

        {!(open && isPending && !data) ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-3">
              <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                <span className="font-medium text-[var(--enterprise-text)]">{draft.length}</span> of{" "}
                {MAX_CUSTOM_MATERIAL_FIELDS} fields · Keys stay stable for API and Excel imports
              </p>
              <button
                type="button"
                onClick={addField}
                disabled={draft.length >= MAX_CUSTOM_MATERIAL_FIELDS}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                Add field
              </button>
            </div>

            <div className="space-y-3">
              {draft.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-6 py-12 text-center shadow-[var(--enterprise-shadow-xs)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
                    <Sparkles className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-[var(--enterprise-text)]">
                    No custom fields yet
                  </p>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                    Extend the catalog beyond the default columns—environmental data,
                    certifications, lead time, and more.
                  </p>
                </div>
              ) : (
                draft.map((f, index) => (
                  <div
                    key={f.id}
                    className="rounded-2xl border border-[var(--enterprise-border)] border-l-[3px] border-l-[var(--enterprise-primary)] bg-[var(--enterprise-surface)] py-4 pl-1 pr-3 shadow-[var(--enterprise-shadow-xs)] ring-1 ring-black/[0.02] dark:ring-white/[0.04]"
                  >
                    <div className="flex flex-wrap items-start gap-3 pl-2">
                      <div className="flex shrink-0 flex-col gap-0.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 p-0.5">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveField(index, -1)}
                          className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-25"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === draft.length - 1}
                          onClick={() => moveField(index, 1)}
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
                                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  f.type === "text"
                                    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                    : f.type === "number"
                                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-200"
                                      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
                                }`}
                              >
                                {f.type === "text"
                                  ? "Text"
                                  : f.type === "number"
                                    ? "Number"
                                    : "Currency"}
                              </span>
                              {f.required ? (
                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                  Required
                                </span>
                              ) : null}
                            </div>
                            <input
                              value={f.label}
                              onChange={(e) => {
                                const label = e.target.value;
                                setDraft((rows) =>
                                  rows.map((r, i) => (i === index ? { ...r, label } : r)),
                                );
                              }}
                              className={fieldInputClass}
                              placeholder="e.g. CO₂ (kg/m³)"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                              Key (slug)
                            </label>
                            <input
                              value={f.key}
                              onChange={(e) =>
                                setDraft((rows) =>
                                  rows.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          key: e.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9_]/g, ""),
                                        }
                                      : r,
                                  ),
                                )
                              }
                              className={`${fieldInputClass} font-mono text-xs`}
                              placeholder="co2_kg_m3"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                              Value type
                            </label>
                            <select
                              value={f.type}
                              onChange={(e) =>
                                setDraft((rows) =>
                                  rows.map((r, i) =>
                                    i === index
                                      ? { ...r, type: e.target.value as MaterialCustomFieldType }
                                      : r,
                                  ),
                                )
                              }
                              className={fieldInputClass}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="currency">Currency amount</option>
                            </select>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-1 py-2 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) =>
                                setDraft((rows) =>
                                  rows.map((r, i) =>
                                    i === index ? { ...r, required: e.target.checked } : r,
                                  ),
                                )
                              }
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
                        onClick={() => removeField(index)}
                        className="shrink-0 rounded-xl p-2.5 text-[var(--enterprise-text-muted)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {previewFields.length > 0 ? (
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
                        {previewFields.map((col) => (
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
                        <td className="px-3 py-2.5 text-[var(--enterprise-text-muted)]">
                          Concrete
                        </td>
                        <td className="px-3 py-2.5">Sample mix</td>
                        {previewFields.map((col) => (
                          <td
                            key={col.id}
                            className="bg-[var(--enterprise-primary-soft)]/15 px-3 py-2.5 tabular-nums text-[var(--enterprise-text-muted)]"
                          >
                            {col.type === "number"
                              ? "12.5"
                              : col.type === "currency"
                                ? "0.00"
                                : "—"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </EnterpriseSlideOver>
  );
}

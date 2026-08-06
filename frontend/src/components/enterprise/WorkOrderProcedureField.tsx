"use client";

import { Plus, Trash2 } from "lucide-react";
import type { WorkOrderChecklistItem } from "@/lib/api-client";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
} from "@/lib/mobileFormStyles";

function newItemId() {
  return `step-${Date.now().toString(36)}`;
}

type Props = {
  items: WorkOrderChecklistItem[];
  onChange: (items: WorkOrderChecklistItem[]) => void;
  disabled?: boolean;
};

export function WorkOrderProcedureField({ items, onChange, disabled }: Props) {
  function update(id: string, patch: Partial<WorkOrderChecklistItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }

  function add() {
    onChange([...items, { id: newItemId(), label: "New step", type: "checkbox", required: false }]);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          No completion checklist yet. Add steps technicians must verify before closing.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className="flex flex-col gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label className={MOBILE_FIELD_LABEL}>Step {idx + 1}</label>
                <input
                  value={it.label}
                  onChange={(e) => update(it.id, { label: e.target.value })}
                  className={MOBILE_FIELD_INPUT}
                  disabled={disabled}
                />
              </div>
              <div className="w-full sm:w-36">
                <label className={MOBILE_FIELD_LABEL}>Type</label>
                <select
                  value={it.type}
                  onChange={(e) =>
                    update(it.id, {
                      type: e.target.value as WorkOrderChecklistItem["type"],
                    })
                  }
                  className={MOBILE_FIELD_SELECT}
                  disabled={disabled}
                >
                  <option value="checkbox">Checkbox</option>
                  <option value="passfail">Pass / fail</option>
                  <option value="text">Note</option>
                  <option value="photo">Photo</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs font-medium text-[var(--enterprise-text-muted)]">
                <input
                  type="checkbox"
                  checked={Boolean(it.required)}
                  onChange={(e) => update(it.id, { required: e.target.checked })}
                  disabled={disabled}
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => remove(it.id)}
                disabled={disabled}
                className="rounded-lg p-2 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--enterprise-primary)]/40 px-3 py-2 text-sm font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-semantic-info-bg)] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Add checklist step
      </button>
    </div>
  );
}

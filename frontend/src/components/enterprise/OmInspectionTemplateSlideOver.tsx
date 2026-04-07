"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { postOmInspectionTemplate, ProRequiredError } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";

const FREQUENCY_OPTIONS = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Bi-annual",
  "Annual",
  "Custom",
] as const;

type Row = { label: string; level: string };

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

export function OmInspectionTemplateSlideOver({ projectId, open, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [rows, setRows] = useState<Row[]>([
    { label: "Fire extinguisher — Lobby", level: "1" },
    { label: "Emergency exit — Main door", level: "1" },
    { label: "Fire door — Stairwell A", level: "1" },
    { label: "Fire extinguisher — Kitchen", level: "2" },
    { label: "Emergency lighting — Corridor", level: "2" },
  ]);

  const addRow = () =>
    setRows((prev) => [...prev, { label: "", level: prev.at(-1)?.level ?? "1" }]);

  const mut = useMutation({
    mutationFn: () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Template name is required.");
      const ts = Date.now();
      const checklistJson = rows
        .map((r, i) => ({
          id: `item-${ts}-${i}`,
          label: r.label.trim(),
          type: "passfail" as const,
          level: r.level.trim() || "1",
        }))
        .filter((r) => r.label.length > 0);
      if (checklistJson.length === 0) throw new Error("Add at least one checklist item.");
      return postOmInspectionTemplate(projectId, {
        name: trimmed,
        frequency: frequency || null,
        checklistJson,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionTemplates(projectId) });
      toast.success("Template created.");
      setName("");
      setFrequency("Monthly");
      setRows([{ label: "", level: "1" }]);
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      panelMaxWidthClass="max-w-[560px]"
      ariaLabelledBy="tpl-slide-title"
      header={
        <div className="min-w-0">
          <h2
            id="tpl-slide-title"
            className="truncate text-lg font-semibold text-[var(--enterprise-text)]"
          >
            + Create Template
          </h2>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            Define checklist items grouped by level. Each item is pass / fail / N/A.
          </p>
        </div>
      }
      bodyClassName="px-5 py-5"
      footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center rounded-lg border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex min-h-10 items-center rounded-lg bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save template
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Template name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fire Safety"
            className="min-h-11 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
          >
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Checklist items
            </span>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </button>
          </div>
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2.5"
              >
                <input
                  value={row.level}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, level: v } : x)));
                  }}
                  placeholder="Lvl"
                  className="min-h-9 w-16 shrink-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-center text-sm"
                />
                <input
                  value={row.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, label: v } : x)));
                  }}
                  placeholder="e.g. Fire extinguisher — Lobby"
                  className="min-h-9 min-w-0 flex-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}

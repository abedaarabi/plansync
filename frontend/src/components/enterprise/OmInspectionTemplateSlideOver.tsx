"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  patchOmInspectionTemplate,
  postOmInspectionTemplate,
  postOmWorkspaceInspectionTemplate,
  type OmInspectionChecklistItem,
  type OmInspectionTemplateRow,
  ProRequiredError,
} from "@/lib/api-client";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { OmFormSection } from "@/components/enterprise/OmFormSection";

const FREQUENCY_OPTIONS = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Bi-annual",
  "Annual",
  "Custom",
] as const;

function frequencyIntervalDays(frequency: string): number | null {
  const f = frequency.trim().toLowerCase();
  if (f === "daily") return 1;
  if (f === "weekly") return 7;
  if (f === "monthly") return 30;
  if (f === "quarterly") return 90;
  if (f === "bi-annual") return 182;
  if (f === "annual") return 365;
  return null;
}

function nextDueHint(frequency: string): string | null {
  const days = frequencyIntervalDays(frequency);
  if (days == null) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const label = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Next due after create ≈ ${label} (${days} day${days === 1 ? "" : "s"}).`;
}

type Row = { id: string; label: string; level: string };

const SAMPLE_ROWS: Omit<Row, "id">[] = [
  { label: "Fire extinguisher — Lobby", level: "1" },
  { label: "Emergency exit — Main door", level: "1" },
  { label: "Fire door — Stairwell A", level: "1" },
  { label: "Fire extinguisher — Kitchen", level: "2" },
  { label: "Emergency lighting — Corridor", level: "2" },
];

function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRows(): Row[] {
  return [{ id: newRowId(), label: "", level: "1" }];
}

function rowsFromTemplate(t: OmInspectionTemplateRow): Row[] {
  if (!Array.isArray(t.checklistJson)) return emptyRows();
  const rows: Row[] = [];
  for (const raw of t.checklistJson) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const level = typeof o.level === "string" && o.level.trim() ? o.level.trim() : "1";
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newRowId();
    rows.push({ id, label, level });
  }
  return rows.length ? rows : emptyRows();
}

type Props = {
  /** Project templates (create/edit). Required unless scope is company. */
  projectId?: string;
  /** Company library create. Required when scope is company. */
  workspaceId?: string;
  /** Default project. Company = shared workspace checklist library. */
  scope?: "project" | "company";
  open: boolean;
  onClose: () => void;
  template?: OmInspectionTemplateRow | null;
};

// fallow-ignore-next-line complexity
export function OmInspectionTemplateSlideOver({
  projectId,
  workspaceId,
  scope = "project",
  open,
  onClose,
  template = null,
}: Props) {
  const qc = useQueryClient();
  const isCompany = scope === "company";
  const isEdit = !isCompany && template !== null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<string>("Monthly");
  const [requireFailEvidence, setRequireFailEvidence] = useState(true);
  const [rows, setRows] = useState<Row[]>(emptyRows);

  useEffect(() => {
    if (!open) return;
    if (template && !isCompany) {
      setName(template.name);
      setDescription(template.description ?? "");
      setFrequency(template.frequency?.trim() || "Monthly");
      setRequireFailEvidence(template.requireFailEvidence !== false);
      setRows(rowsFromTemplate(template));
      return;
    }
    setName("");
    setDescription("");
    setFrequency("Monthly");
    setRequireFailEvidence(true);
    setRows(emptyRows());
  }, [open, template, isCompany]);

  const addRow = () =>
    setRows((prev) => [...prev, { id: newRowId(), label: "", level: prev.at(-1)?.level ?? "1" }]);

  const loadSample = () => {
    setName((n) => n.trim() || "Fire Safety");
    setRows(SAMPLE_ROWS.map((r) => ({ ...r, id: newRowId() })));
  };

  const mut = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Template name is required.");
      const checklistJson: OmInspectionChecklistItem[] = rows
        .map((r, i) => ({
          id: r.id || `item-${Date.now()}-${i}`,
          label: r.label.trim(),
          type: "passfail" as const,
          level: r.level.trim() || "1",
        }))
        .filter((r) => r.label.length > 0);
      if (checklistJson.length === 0) throw new Error("Add at least one checklist item.");

      if (isCompany) {
        if (!workspaceId) throw new Error("No workspace selected.");
        await postOmWorkspaceInspectionTemplate(workspaceId, {
          name: trimmed,
          description: description.trim() || null,
          frequency: frequency || null,
          checklistJson,
        });
        return;
      }

      if (!projectId) throw new Error("No project selected.");
      const body = {
        name: trimmed,
        description: description.trim() || null,
        frequency: frequency || null,
        requireFailEvidence,
        checklistJson,
      };

      if (isEdit && template) {
        await patchOmInspectionTemplate(projectId, template.id, body);
        return;
      }
      await postOmInspectionTemplate(projectId, body);
    },
    onSuccess: async () => {
      if (isCompany && workspaceId) {
        await qc.invalidateQueries({
          queryKey: qk.omWorkspaceInspectionTemplates(workspaceId),
        });
        toast.success("Company template created.");
      } else if (projectId) {
        await qc.invalidateQueries({ queryKey: qk.omInspectionTemplates(projectId) });
        toast.success(isEdit ? "Template updated." : "Template created.");
      }
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const title = isCompany ? "New company template" : isEdit ? "Edit template" : "New template";
  const subtitle = isCompany
    ? "Shared across projects. Import into a building when you need to run it."
    : "Organize line items into sections. In the field each item is Pass, Fail, or N/A.";

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      overlayZClass={isCompany ? "z-[120]" : undefined}
      ariaLabelledBy="tpl-slide-title"
      header={
        <SlideOverHeader
          icon={ClipboardCheck}
          titleId="tpl-slide-title"
          title={title}
          description={subtitle}
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            size="sm"
            loading={mut.isPending}
            onClick={() => mut.mutate()}
          >
            {isEdit ? "Save changes" : isCompany ? "Create company template" : "Create template"}
          </EnterpriseButton>
        </>
      }
    >
      <div className="space-y-7">
        <OmFormSection title="Basics">
          <div>
            <label htmlFor="tpl-name" className={MOBILE_FIELD_LABEL}>
              Template name
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fire Safety Walk"
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="tpl-desc" className={MOBILE_FIELD_LABEL}>
              Description{" "}
              <span className="font-normal text-[var(--enterprise-text-muted)]">(optional)</span>
            </label>
            <textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this inspection covers…"
              className={`${MOBILE_FIELD_INPUT} min-h-[4.5rem] resize-y`}
            />
          </div>
          <div>
            <p className={MOBILE_FIELD_LABEL}>Frequency</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((f) => {
                const active = frequency === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFrequency(f)}
                    className={`inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-semibold transition ${
                      active
                        ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                        : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            {!isCompany && nextDueHint(frequency) ? (
              <p className="mt-1.5 text-[11px] text-[var(--enterprise-text-muted)]">
                {nextDueHint(frequency)}
                {template?.nextDueAt
                  ? ` Current next due: ${new Date(template.nextDueAt).toLocaleDateString(
                      undefined,
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    )}.`
                  : null}
              </p>
            ) : null}
            {isCompany ? (
              <p className="mt-1.5 text-[11px] text-[var(--enterprise-text-muted)]">
                Frequency is a suggested cadence. Scheduling starts when a project imports this
                template.
              </p>
            ) : null}
          </div>
          {!isCompany ? (
            <label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5">
              <input
                type="checkbox"
                checked={requireFailEvidence}
                onChange={(e) => setRequireFailEvidence(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--enterprise-border)] text-[var(--enterprise-primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--enterprise-text)]">
                  Require evidence on Fail
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--enterprise-text-muted)]">
                  Fail items need a photo and note before the inspection can be completed.
                </span>
              </span>
            </label>
          ) : null}
        </OmFormSection>

        <OmFormSection
          title="Checklist"
          description="Sections group line items (like Procore/Dalux) — e.g. Lobby, Stairwell, Roof."
        >
          {!isEdit ? (
            <button
              type="button"
              onClick={loadSample}
              className="text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Load fire-safety sample items
            </button>
          ) : null}
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li
                key={row.id}
                className="flex items-start gap-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-2.5"
              >
                <div className="w-[4.5rem] shrink-0">
                  <label className="sr-only" htmlFor={`tpl-lvl-${row.id}`}>
                    Section
                  </label>
                  <input
                    id={`tpl-lvl-${row.id}`}
                    value={row.level}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, level: v } : x)));
                    }}
                    placeholder="Section"
                    title="Section"
                    className="min-h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 text-center text-[11px] font-semibold text-[var(--enterprise-text)]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`tpl-item-${row.id}`}>
                    Checklist item
                  </label>
                  <input
                    id={`tpl-item-${row.id}`}
                    value={row.label}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, label: v } : x)));
                    }}
                    placeholder="e.g. Fire extinguisher — Lobby"
                    className="min-h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-sm text-[var(--enterprise-text)]"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--enterprise-border)] text-sm font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
          >
            <Plus className="h-4 w-4" />
            Add checklist item
          </button>
        </OmFormSection>
      </div>
    </EnterpriseSlideOver>
  );
}

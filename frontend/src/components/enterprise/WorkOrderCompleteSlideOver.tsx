"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Clock, Package } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import {
  fetchOmPartsInventory,
  postWorkOrderComplete,
  type IssueRow,
  type WorkOrderChecklistItem,
  type WorkOrderChecklistResult,
  type WorkOrderPartUsed,
  ProRequiredError,
} from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";

type Props = {
  open: boolean;
  issue: IssueRow | null;
  projectId: string;
  onClose: () => void;
  onCompleted: () => void;
};

function defaultResults(
  checklist: WorkOrderChecklistItem[],
  existing?: WorkOrderChecklistResult[],
): Record<string, WorkOrderChecklistResult> {
  const map: Record<string, WorkOrderChecklistResult> = {};
  for (const it of checklist) {
    const hit = existing?.find((r) => r.itemId === it.id);
    map[it.id] = hit ?? { itemId: it.id, outcome: null, note: "" };
  }
  return map;
}

export function WorkOrderCompleteSlideOver({
  open,
  issue,
  projectId,
  onClose,
  onCompleted,
}: Props) {
  const checklist = issue?.procedureJson ?? [];
  const [results, setResults] = useState<Record<string, WorkOrderChecklistResult>>({});
  const [laborMinutes, setLaborMinutes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [parts, setParts] = useState<WorkOrderPartUsed[]>([]);

  const { data: inventory = [] } = useQuery({
    queryKey: qk.omPartsInventory(projectId),
    queryFn: () => fetchOmPartsInventory(projectId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !issue) return;
    const steps = issue.procedureJson ?? [];
    setResults(defaultResults(steps, issue.procedureResultJson));
    setLaborMinutes(issue.laborMinutes != null ? String(issue.laborMinutes) : "");
    setCompletionNotes("");
    setParts(issue.partsUsedJson ?? []);
  }, [
    open,
    issue?.id,
    issue?.procedureJson,
    issue?.procedureResultJson,
    issue?.laborMinutes,
    issue?.partsUsedJson,
  ]);

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("Missing work order.");
      const procedureResultJson = Object.values(results);
      const labor = laborMinutes.trim() ? parseInt(laborMinutes, 10) : undefined;
      return postWorkOrderComplete(projectId, issue.id, {
        procedureResultJson,
        laborMinutes: Number.isFinite(labor) ? labor : undefined,
        partsUsedJson: parts.length > 0 ? parts : undefined,
        completionNotes: completionNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Work order completed.");
      onCompleted();
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro required." : e.message);
    },
  });

  const canSubmit = useMemo(() => {
    if (!issue) return false;
    for (const it of checklist) {
      if (!it.required) continue;
      const r = results[it.id];
      if (!r || r.outcome === null) return false;
      if (it.type === "text" && !r.note?.trim()) return false;
    }
    if (issue.completionEvidenceRequired && (issue.referencePhotos?.length ?? 0) === 0) {
      return false;
    }
    return true;
  }, [issue, checklist, results]);

  if (!issue) return null;

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!canSubmit) return;
          completeMut.mutate();
        },
      }}
      ariaLabelledBy="wo-complete-title"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
      bodyClassName="px-5 py-5"
      header={
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)]">
            <CheckCircle2 className="h-5 w-5 text-[var(--enterprise-semantic-success-text)]" />
          </div>
          <div>
            <p className="enterprise-type-label text-[var(--enterprise-semantic-success-text)]">
              Complete
            </p>
            <h2 id="wo-complete-title" className="text-lg font-bold text-[var(--enterprise-text)]">
              Close work order
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--enterprise-text-muted)]">{issue.title}</p>
          </div>
        </div>
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" loading={completeMut.isPending} disabled={!canSubmit}>
            {completeMut.isPending ? "Saving…" : "Mark complete"}
          </EnterpriseButton>
        </>
      }
    >
      <div className="space-y-4">
        {issue.completionEvidenceRequired && (issue.referencePhotos?.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Add at least one completion photo before closing (required for this work order).
          </p>
        ) : null}

        {checklist.length > 0 ? (
          <div className={MOBILE_FORM_SECTION}>
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Checklist</p>
            <ul className="space-y-3">
              {checklist.map((it) => {
                const r = results[it.id] ?? { itemId: it.id, outcome: null, note: "" };
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border border-[var(--enterprise-border)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                      {it.label}
                      {it.required ? <span className="text-red-500"> *</span> : null}
                    </p>
                    {it.type === "passfail" ? (
                      <div className="mt-2 flex gap-2">
                        {(["pass", "fail", "na"] as const).map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() =>
                              setResults((prev) => ({
                                ...prev,
                                [it.id]: { ...r, outcome: o },
                              }))
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                              r.outcome === o
                                ? "bg-[var(--enterprise-primary)] text-white"
                                : "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : it.type === "text" ? (
                      <textarea
                        value={r.note ?? ""}
                        onChange={(e) =>
                          setResults((prev) => ({
                            ...prev,
                            [it.id]: { ...r, outcome: "done", note: e.target.value },
                          }))
                        }
                        rows={2}
                        className={`${MOBILE_FIELD_TEXTAREA} mt-2`}
                        placeholder="Enter notes…"
                      />
                    ) : (
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={r.outcome === "done" || r.outcome === "pass"}
                          onChange={(e) =>
                            setResults((prev) => ({
                              ...prev,
                              [it.id]: { ...r, outcome: e.target.checked ? "done" : null },
                            }))
                          }
                        />
                        Done
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <div>
            <label htmlFor="wo-labor" className={MOBILE_FIELD_LABEL}>
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Labor (minutes)
            </label>
            <input
              id="wo-labor"
              type="number"
              min={0}
              value={laborMinutes}
              onChange={(e) => setLaborMinutes(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            <Package className="mr-1 inline h-3.5 w-3.5" />
            Parts used
          </p>
          {parts.map((p, idx) => (
            <div key={idx} className="mb-2 grid gap-2 sm:grid-cols-3">
              <input
                value={p.partName}
                onChange={(e) => {
                  const next = [...parts];
                  next[idx] = { ...p, partName: e.target.value };
                  setParts(next);
                }}
                className={MOBILE_FIELD_INPUT}
                placeholder="Part name"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={p.qty}
                onChange={(e) => {
                  const next = [...parts];
                  next[idx] = { ...p, qty: parseFloat(e.target.value) || 0 };
                  setParts(next);
                }}
                className={MOBILE_FIELD_INPUT}
                placeholder="Qty"
              />
              <select
                value={p.inventoryItemId ?? ""}
                onChange={(e) => {
                  const next = [...parts];
                  const item = inventory.find((i) => i.id === e.target.value);
                  next[idx] = {
                    ...p,
                    inventoryItemId: e.target.value || undefined,
                    partName: item?.name ?? p.partName,
                    unitCost: item?.unitCost ?? p.unitCost,
                  };
                  setParts(next);
                }}
                className={MOBILE_FIELD_INPUT}
              >
                <option value="">From stock (optional)</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.quantity} on hand)
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setParts([...parts, { partName: "", qty: 1 }])}
            className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
          >
            + Add part
          </button>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <label htmlFor="wo-complete-notes" className={MOBILE_FIELD_LABEL}>
            Completion notes
          </label>
          <textarea
            id="wo-complete-notes"
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            rows={3}
            className={MOBILE_FIELD_TEXTAREA}
            placeholder="What was done, follow-ups…"
          />
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}

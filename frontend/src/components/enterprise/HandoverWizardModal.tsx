"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchProjectTeam,
  patchOmHandoverBrief,
  type ProjectSessionOmHandover,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  omHandover: ProjectSessionOmHandover;
};

export function HandoverWizardModal({ projectId, projectName, open, onClose, omHandover }: Props) {
  const qc = useQueryClient();
  const { data: team } = useQuery({
    queryKey: ["projectTeam", projectId, "wizard"],
    queryFn: () => fetchProjectTeam(projectId),
    enabled: open,
  });

  const [buildingLabel, setBuildingLabel] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [facilityManagerUserId, setFacilityManagerUserId] = useState("");
  const [transferAsBuilt, setTransferAsBuilt] = useState(true);
  const [transferClosedIssues, setTransferClosedIssues] = useState(true);
  const [transferPunch, setTransferPunch] = useState(true);
  const [transferTeamAccess, setTransferTeamAccess] = useState(true);

  useEffect(() => {
    if (!open) return;
    setBuildingLabel(omHandover.buildingLabel?.trim() || projectName);
    setHandoverDate(omHandover.handoverDate ?? "");
    setFacilityManagerUserId(omHandover.facilityManagerUserId ?? "");
    setTransferAsBuilt(omHandover.transferAsBuilt);
    setTransferClosedIssues(omHandover.transferClosedIssues);
    setTransferPunch(omHandover.transferPunch);
    setTransferTeamAccess(omHandover.transferTeamAccess);
  }, [open, omHandover, projectName]);

  const saveMut = useMutation({
    mutationFn: () =>
      patchOmHandoverBrief(projectId, {
        buildingLabel: buildingLabel.trim() || null,
        handoverDate: handoverDate.trim() || null,
        facilityManagerUserId: facilityManagerUserId.trim() || null,
        transferAsBuilt,
        transferClosedIssues,
        transferPunch,
        transferTeamAccess,
        handoverWizardCompletedAt: new Date().toISOString(),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omHandover(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omFmDashboard(projectId) });
      toast.success("Handover to FM recorded.");
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-wizard-title"
    >
      <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--enterprise-border)] px-5 py-4">
          <div>
            <h2
              id="handover-wizard-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Hand over to facility management
            </h2>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Records intent and notifies the facility contact. Drawings and data stay on this
              project — use modules and roles to control access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-bg)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Building / site name
            </span>
            <input
              value={buildingLabel}
              onChange={(e) => setBuildingLabel(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Handover date
            </span>
            <input
              type="date"
              value={handoverDate}
              onChange={(e) => setHandoverDate(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Facility manager (workspace member)
            </span>
            <select
              value={facilityManagerUserId}
              onChange={(e) => setFacilityManagerUserId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
            >
              <option value="">— Select —</option>
              {(team?.members ?? []).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--enterprise-text-muted)]">
              Transfer checklist (planning)
            </legend>
            <label className="flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
              <input
                type="checkbox"
                checked={transferAsBuilt}
                onChange={(e) => setTransferAsBuilt(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--enterprise-primary)]"
              />
              As-built drawings in Files
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
              <input
                type="checkbox"
                checked={transferClosedIssues}
                onChange={(e) => setTransferClosedIssues(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--enterprise-primary)]"
              />
              Closed issues as records
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
              <input
                type="checkbox"
                checked={transferPunch}
                onChange={(e) => setTransferPunch(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--enterprise-primary)]"
              />
              Punch list as snag register
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
              <input
                type="checkbox"
                checked={transferTeamAccess}
                onChange={(e) => setTransferTeamAccess(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--enterprise-primary)]"
              />
              Team access for FM
            </label>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--enterprise-border)] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
            className="min-h-11 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : "Complete handover →"}
          </button>
        </div>
      </div>
    </div>
  );
}

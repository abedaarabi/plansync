"use client";

import { Check, MapPin, Pencil, X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";

type Step = {
  id: string;
  label: string;
  icon: typeof MapPin;
  active: boolean;
  done: boolean;
};

/**
 * Unified step indicator for the issue workflow (replaces scattered banners).
 */
export function ViewerStepIndicator() {
  const newIssuePlacementActive = useViewerStore((s) => s.newIssuePlacementActive);
  const issueCreateDraft = useViewerStore((s) => s.issueCreateDraft);
  const issuePlacement = useViewerStore((s) => s.issuePlacement);
  const rightFlyout = useViewerStore((s) => s.rightFlyout);
  const issueEditId = useViewerStore((s) => s.issueEditId);
  const setNewIssuePlacementActive = useViewerStore((s) => s.setNewIssuePlacementActive);
  const closeIssueFlyout = useViewerStore((s) => s.closeIssueFlyout);
  const setIssueCreateDraft = useViewerStore((s) => s.setIssueCreateDraft);
  const setIssuePlacement = useViewerStore((s) => s.setIssuePlacement);

  const inCreateFlow =
    newIssuePlacementActive || issueCreateDraft != null || issuePlacement != null;
  const placingPin = newIssuePlacementActive || issuePlacement != null;
  const inEditFlow = Boolean(issueEditId && rightFlyout === "issue");
  const inFormStep = issueCreateDraft != null || inEditFlow;

  if (!inCreateFlow && !inEditFlow) return null;

  const steps: Step[] = inEditFlow
    ? [
        {
          id: "edit",
          label: "Edit issue",
          icon: Pencil,
          active: true,
          done: false,
        },
      ]
    : [
        {
          id: "place",
          label: issuePlacement ? "Reposition pin" : "Place pin",
          icon: MapPin,
          active: placingPin,
          done: issueCreateDraft != null && !placingPin,
        },
        {
          id: "details",
          label: "Add details",
          icon: Pencil,
          active: inFormStep,
          done: false,
        },
      ];

  const onCancel = () => {
    if (issueCreateDraft || inEditFlow) {
      closeIssueFlyout();
      return;
    }
    setNewIssuePlacementActive(false);
    setIssueCreateDraft(null);
    setIssuePlacement(null);
  };

  return (
    <div
      className="no-print pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-[min(100%,42rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-white/94 px-3 py-2 shadow-lg ring-1 ring-sky-500/20 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center gap-1.5">
                {idx > 0 ? (
                  <span className="hidden h-px w-4 bg-slate-300 sm:block" aria-hidden />
                ) : null}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    step.done
                      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
                      : step.active
                        ? "border-sky-500/50 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {step.done ? (
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Icon className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
                  )}
                  <span>{step.label}</span>
                </span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="viewer-focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
          Cancel
        </button>
      </div>
    </div>
  );
}

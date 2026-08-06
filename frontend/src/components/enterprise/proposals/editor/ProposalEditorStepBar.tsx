"use client";

import { Check } from "lucide-react";
import {
  EDITOR_STEPS,
  type ActiveSection,
} from "@/components/enterprise/proposals/editor/proposalEditorShared";

export function ProposalEditorStepBar({
  activeSection,
  onSelect,
  unlocked,
}: {
  activeSection: ActiveSection;
  onSelect: (section: ActiveSection) => void;
  /** Steps the user may jump to (e.g. require draft for pricing+). */
  unlocked: Record<ActiveSection, boolean>;
}) {
  const activeIdx = EDITOR_STEPS.findIndex((s) => s.id === activeSection);

  return (
    <nav
      aria-label="Proposal editor steps"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 sm:px-4"
    >
      {EDITOR_STEPS.map((step, idx) => {
        const isActive = step.id === activeSection;
        const isCompleted = idx < activeIdx;
        // Completed + current always clickable when unlocked; also allow the next step
        const clickable = unlocked[step.id] && (idx <= activeIdx || idx === activeIdx + 1);

        return (
          <div key={step.id} className="flex min-w-0 items-center">
            {idx > 0 && (
              <div
                className={`mx-1 hidden h-px w-4 shrink-0 sm:mx-2 sm:w-8 md:block ${
                  idx <= activeIdx
                    ? "bg-[var(--enterprise-primary)]"
                    : "bg-[var(--enterprise-border)]"
                }`}
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (clickable) onSelect(step.id);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:gap-2 sm:px-2.5 ${
                isActive
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
                  : isCompleted && unlocked[step.id]
                    ? "text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                    : "text-[var(--enterprise-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isActive
                    ? "bg-[var(--enterprise-primary)] text-white"
                    : isCompleted && unlocked[step.id]
                      ? "bg-[var(--enterprise-success)] text-white"
                      : "bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] ring-1 ring-[var(--enterprise-border)]"
                }`}
              >
                {isCompleted && unlocked[step.id] ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  step.number
                )}
              </span>
              <span className="whitespace-nowrap">
                <span className="hidden sm:inline">{step.number}. </span>
                {step.label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

export type PipelineTimelineStepState = "done" | "active" | "pending" | "failed";

export type PipelineTimelineStep = {
  id: string;
  label: string;
  statusText: string;
  state: PipelineTimelineStepState;
  progressPct?: number | null;
};

function TimelineNode({ state }: { state: PipelineTimelineStepState }) {
  if (state === "done") {
    return (
      <span
        className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 shadow-[0_0_0_3px_var(--enterprise-surface)]"
        aria-hidden
      >
        <Check className="h-3 w-3 stroke-[2.5] text-white" />
      </span>
    );
  }

  if (state === "failed") {
    return (
      <span
        className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-[0_0_0_3px_var(--enterprise-surface)]"
        aria-hidden
      >
        <X className="h-3 w-3 stroke-[2.5] text-white" />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span
        className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center shadow-[0_0_0_3px_var(--enterprise-surface)]"
        aria-hidden
      >
        <span className="enterprise-timeline-spinner" />
      </span>
    );
  }

  return (
    <span
      className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white shadow-[0_0_0_3px_var(--enterprise-surface)]"
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
    </span>
  );
}

function connectorTone(
  state: PipelineTimelineStepState,
  nextState?: PipelineTimelineStepState,
): string {
  if (state === "done") return "bg-emerald-300/90";
  if (state === "active" && nextState === "pending")
    return "bg-gradient-to-b from-[var(--enterprise-primary)]/35 to-slate-200";
  return "bg-slate-200";
}

export function PipelineTimeline({
  steps,
  side,
  footer,
  failedMessage,
}: {
  steps: PipelineTimelineStep[];
  side?: ReactNode;
  footer?: ReactNode;
  failedMessage?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div
        className={
          side ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(240px,34%)] lg:items-start" : undefined
        }
      >
        <ol className="relative m-0 list-none p-0">
          {steps.map(
            // fallow-ignore-next-line complexity
            (step, index) => {
              const isLast = index === steps.length - 1;
              const next = steps[index + 1];
              const active = step.state === "active";
              const done = step.state === "done";

              return (
                <li
                  key={step.id}
                  className={`relative flex gap-3.5 ${isLast ? "" : "pb-5"}`}
                  aria-current={active ? "step" : undefined}
                >
                  {!isLast ? (
                    <span
                      className={`absolute left-[9px] top-5 bottom-0 w-px ${connectorTone(step.state, next?.state)}`}
                      aria-hidden
                    />
                  ) : null}

                  <div className="pt-0.5">
                    <TimelineNode state={step.state} />
                  </div>

                  <div className="min-w-0 flex-1 pt-px">
                    <p
                      className={`text-sm leading-snug ${
                        done
                          ? "font-medium text-emerald-900/90"
                          : active
                            ? "font-semibold text-[var(--enterprise-text)]"
                            : step.state === "failed"
                              ? "font-semibold text-red-900"
                              : "text-[var(--enterprise-text-muted)]"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        done
                          ? "text-emerald-700/75"
                          : active
                            ? "text-[var(--enterprise-text-muted)]"
                            : step.state === "failed"
                              ? "text-red-700"
                              : "text-[var(--enterprise-text-muted)]/80"
                      }`}
                    >
                      {step.statusText}
                    </p>
                    {active && step.progressPct != null && step.progressPct > 0 ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[var(--enterprise-primary)] transition-all duration-300 ease-out"
                          style={{ width: `${Math.min(100, Math.max(4, step.progressPct))}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            },
          )}
        </ol>

        {side ? <div className="min-w-0">{side}</div> : null}
      </div>

      {failedMessage ? <p className="text-sm text-red-800">{failedMessage}</p> : null}

      {footer ? (
        <div className="rounded-xl border border-[var(--enterprise-border-subtle)] bg-slate-50/80 px-3.5 py-3 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

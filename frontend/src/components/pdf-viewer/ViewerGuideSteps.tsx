"use client";

import { Check } from "lucide-react";

export type ViewerGuideStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
};

/** Compact numbered checklist used by calibration / issue guides. */
export function ViewerGuideSteps(props: { steps: ViewerGuideStep[]; listClassName?: string }) {
  return (
    <ol className={props.listClassName ?? "space-y-2"}>
      {props.steps.map((step, index) => (
        <li key={step.key} className="flex gap-2 text-[10px] leading-snug">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
              step.done
                ? "border-blue-500/60 bg-blue-50 text-blue-700"
                : "border-slate-300 text-slate-500"
            }`}
            aria-hidden
          >
            {step.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
          </span>
          <span>
            <span className={`font-medium ${step.done ? "text-slate-700" : "text-slate-500"}`}>
              {step.title}
            </span>
            <span className="mt-0.5 block text-slate-500">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { BIM_WALK_PLAN_SIZE_OPTIONS, type BimWalkPlanSize } from "@/lib/bim/walkPlanSize";

/** Compact Off / Mini / Big segment for walk-mode 2D plan. */
export function BimWalkPlanSizeControl(props: {
  size: BimWalkPlanSize;
  onChange: (size: BimWalkPlanSize) => void;
  className?: string;
}) {
  return (
    <div
      className={`bim-walk-plan-size${props.className ? ` ${props.className}` : ""}`}
      role="group"
      aria-label="2D plan size"
    >
      {BIM_WALK_PLAN_SIZE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={props.size === option.id}
          data-active={props.size === option.id}
          className="bim-walk-plan-size__btn"
          onClick={() => props.onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

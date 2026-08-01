"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

type Transform = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotationDeg: number;
};

type Props = {
  transform: Transform;
  onChange: (t: Transform) => void;
  step?: number;
  compact?: boolean;
};

export function TransformNudgeControls({
  transform,
  onChange,
  step = 0.01,
  compact = false,
}: Props) {
  const nudge = (dx: number, dy: number) => {
    onChange({
      ...transform,
      offsetX: transform.offsetX + dx,
      offsetY: transform.offsetY + dy,
    });
  };

  const btnClass = compact
    ? "registration-toolbar-btn p-1"
    : "registration-toolbar-btn mobile-touch-target p-2";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? "gap-2" : "gap-4"}`}>
      <div className="grid grid-cols-3 gap-0.5">
        <span />
        <button
          type="button"
          className={btnClass}
          aria-label="Nudge up"
          onClick={() => nudge(0, -step)}
        >
          <ArrowUp className={iconClass} />
        </button>
        <span />
        <button
          type="button"
          className={btnClass}
          aria-label="Nudge left"
          onClick={() => nudge(-step, 0)}
        >
          <ArrowLeft className={iconClass} />
        </button>
        <span className="flex items-center justify-center text-[10px] text-[var(--enterprise-text-muted)]">
          Offset
        </span>
        <button
          type="button"
          className={btnClass}
          aria-label="Nudge right"
          onClick={() => nudge(step, 0)}
        >
          <ArrowRight className={iconClass} />
        </button>
        <span />
        <button
          type="button"
          className={btnClass}
          aria-label="Nudge down"
          onClick={() => nudge(0, step)}
        >
          <ArrowDown className={iconClass} />
        </button>
        <span />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-[var(--enterprise-text-muted)]">
        Scale
        <input
          type="number"
          className={`registration-input ${compact ? "w-16" : "w-24 py-2 text-base"}`}
          step={0.01}
          value={Number(transform.scale.toFixed(4))}
          onChange={(e) => onChange({ ...transform, scale: Number(e.target.value) || 1 })}
        />
      </label>
    </div>
  );
}

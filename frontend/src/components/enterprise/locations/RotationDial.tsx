"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { snapRotationDeg } from "@/lib/locations/calibrationMath";

type Props = {
  rotationDeg: number;
  onChange: (deg: number) => void;
  compact?: boolean;
};

function normalizeDeg(deg: number): number {
  const n = ((deg % 360) + 360) % 360;
  return n > 180 ? n - 360 : n;
}

export function RotationDial({ rotationDeg, onChange, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointer = (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    onChange(normalizeDeg(Math.round(angle)));
  };

  const btnClass = compact
    ? "registration-toolbar-btn p-1"
    : "registration-toolbar-btn mobile-touch-target p-2";

  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "flex-col gap-1"}`}>
      <span
        className={`text-[var(--enterprise-text-muted)] ${compact ? "text-[10px]" : "enterprise-type-caption"}`}
      >
        Rotation
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btnClass}
          aria-label="Rotate −90°"
          title="Rotate −90°"
          onClick={() => onChange(normalizeDeg(rotationDeg - 90))}
        >
          <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </button>
        <div
          ref={ref}
          role="slider"
          aria-label="Rotation"
          aria-valuenow={rotationDeg}
          className={`relative cursor-pointer rounded-full border-2 border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-sm ${compact ? "flex h-10 w-10 items-center justify-center" : "mobile-touch-target flex h-14 w-14 items-center justify-center"}`}
          onPointerDown={(e) => {
            handlePointer(e);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) handlePointer(e);
          }}
        >
          <span
            className="absolute h-1 w-5 origin-left rounded bg-[var(--enterprise-primary)]"
            style={{ transform: `rotate(${rotationDeg}deg)` }}
          />
          <span
            className={`text-[var(--enterprise-text-muted)] ${compact ? "text-[10px]" : "text-xs"}`}
          >
            {Math.round(rotationDeg)}°
          </span>
        </div>
        <button
          type="button"
          className={btnClass}
          aria-label="Rotate +90°"
          title="Rotate +90°"
          onClick={() => onChange(normalizeDeg(rotationDeg + 90))}
        >
          <RotateCw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </button>
        <button
          type="button"
          className={`${btnClass} px-1.5 text-[10px] font-medium text-[var(--enterprise-text-muted)]`}
          aria-label="Snap rotation to nearest 90°"
          title="Snap to 90°"
          onClick={() => onChange(normalizeDeg(snapRotationDeg(rotationDeg, 90)))}
        >
          90°
        </button>
      </div>
    </div>
  );
}

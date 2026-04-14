"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { displayLengthToMm, mmToDisplayLength, type MeasureUnit } from "@/lib/coords";

type Props = {
  open: boolean;
  onConfirm: (knownLengthMm: number) => void;
  onCancel: () => void;
  measureUnit: MeasureUnit;
  /** Page overlay (same box as calibration clicks) — used with midNorm for screen position */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Midpoint of the two calibration points in normalized page coords (0–1) */
  midNorm: { x: number; y: number } | null;
  /** Pre-fill from last successful calibration on this page (localStorage). */
  initialKnownMm: number | null;
};

const POP_W = 248;
const POP_H_EST = 152;
const GAP = 8;
const PAD = 8;

function useCalibratePopoverStyle(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  midNorm: { x: number; y: number } | null,
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el || !midNorm || typeof window === "undefined") {
      setStyle(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const ax = r.left + midNorm.x * r.width;
    const ay = r.top + midNorm.y * r.height;

    let top = ay - GAP - POP_H_EST;
    if (top < PAD) {
      top = ay + GAP;
      if (top + POP_H_EST > window.innerHeight - PAD) {
        top = Math.max(PAD, window.innerHeight - PAD - POP_H_EST);
      }
    } else if (top + POP_H_EST > window.innerHeight - PAD) {
      top = Math.max(PAD, window.innerHeight - PAD - POP_H_EST);
    }

    let left = ax - POP_W / 2;
    left = Math.min(Math.max(left, PAD), window.innerWidth - PAD - POP_W);

    setStyle({
      position: "fixed",
      top,
      left,
      width: POP_W,
      zIndex: 100,
    });
  }, [anchorRef, midNorm]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return open ? style : null;
}

export function CalibrateDialog({
  open,
  onConfirm,
  onCancel,
  measureUnit,
  anchorRef,
  midNorm,
  initialKnownMm,
}: Props) {
  const [value, setValue] = useState("");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const popoverStyle = useCalibratePopoverStyle(open, anchorRef, midNorm);

  useEffect(() => {
    if (!open) return;
    if (initialKnownMm != null && initialKnownMm > 0) {
      setValue(String(mmToDisplayLength(initialKnownMm, measureUnit)));
    } else {
      setValue("");
    }
  }, [open, initialKnownMm, measureUnit]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !mounted || typeof document === "undefined" || !popoverStyle || !midNorm) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Dismiss calibration"
        className="fixed inset-0 z-[90] cursor-default bg-slate-950/35 print:hidden"
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        style={popoverStyle}
        className="rounded-lg border border-[#334155] bg-[#1E293B] p-3 text-[#F8FAFC] shadow-2xl ring-1 ring-black/25 print:hidden"
        role="dialog"
        aria-labelledby="calibrate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="calibrate-title"
          className="text-[13px] font-semibold tracking-tight text-[#F8FAFC]"
        >
          Known distance
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-[#94A3B8]">
          Between the two snapped points ({measureUnit} on the sheet). While you drag to the second
          point, the live label uses your selected measure unit; before Apply it reflects PDF
          coordinate space (72 pt = 1 in), not site scale until you enter the known length. If you
          calibrated this page before, the last known distance is prefilled.
        </p>
        <label className="mt-2 block text-[11px] font-medium text-[#94A3B8]">
          {measureUnit}
          <input
            type="number"
            min={0.001}
            step="any"
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0F172A] px-2 py-1.5 text-[12px] text-[#F8FAFC] outline-none transition placeholder:text-[#64748B] focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/35"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            title={`Real-world distance between calibration points (${measureUnit})`}
            autoFocus
          />
        </label>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC]"
            title="Cancel calibration"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#1D4ED8]"
            title="Apply scale"
            onClick={() => {
              const n = parseFloat(value);
              if (!Number.isFinite(n) || n <= 0) return;
              onConfirm(displayLengthToMm(n, measureUnit));
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

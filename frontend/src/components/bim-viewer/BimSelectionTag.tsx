"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BimEngine, BimSelection } from "./bimEngine";

// fallow-ignore-next-line complexity
export function BimSelectionTag(props: {
  engine: BimEngine | null;
  selection: BimSelection;
  onShowProperties: () => void;
  onDismiss: () => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const posKeyRef = useRef("");

  useEffect(() => {
    const engine = props.engine;
    if (!engine) {
      posKeyRef.current = "";
      setPos(null);
      return;
    }

    let cancelled = false;
    let raf = 0;

    // fallow-ignore-next-line complexity
    const tick = () => {
      if (cancelled) return;
      const sel = props.selection;
      const point = sel.position;
      if (
        !point ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.z)
      ) {
        if (posKeyRef.current !== "none") {
          posKeyRef.current = "none";
          setPos(null);
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const projected = engine.projectWorldToScreen(point.x, point.y, point.z);
      if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const key = `${Math.round(projected.x)}:${Math.round(projected.y)}:${projected.visible ? 1 : 0}`;
      if (key !== posKeyRef.current) {
        posKeyRef.current = key;
        setPos(projected);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [props.engine, props.selection]);

  if (!pos?.visible || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;

  const label = props.selection.name ?? "Unnamed element";
  const sub = [props.selection.ifcType, props.selection.storey].filter(Boolean).join(" · ");

  return (
    <div
      className="bim-selection-tag bim-glass-surface"
      style={{ left: pos.x, top: pos.y }}
      role="group"
      aria-label={`Selected: ${label}`}
    >
      <p className="bim-selection-tag__label">{label}</p>
      {sub ? <p className="bim-selection-tag__sub">{sub}</p> : null}
      <div className="bim-selection-tag__actions">
        <button
          type="button"
          onClick={props.onShowProperties}
          className="bim-selection-tag__btn bim-selection-tag__btn-primary bim-focus-ring mobile-touch-target"
        >
          Show properties
        </button>
        <button
          type="button"
          onClick={props.onDismiss}
          aria-label="Clear selection"
          className="bim-selection-tag__btn bim-selection-tag__btn-ghost bim-focus-ring mobile-touch-target flex h-8 w-8 items-center justify-center p-0"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

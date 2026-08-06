"use client";

import { useRef, useState, type PointerEvent } from "react";

type Props = {
  disabled?: boolean;
  /** Called whenever the canvas content changes (including clear → null). */
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

/**
 * Lightweight ink signature pad (touch + mouse). Emits a PNG data URL.
 */
export function OmInspectionSignaturePad({ disabled, onChange, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const from = last.current;
    if (!canvas || !ctx || !from) return;
    const to = pos(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    inkRef.current = true;
    if (!hasInk) setHasInk(true);
  };

  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && inkRef.current) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    inkRef.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        className="h-[7.5rem] w-full touch-none rounded-xl border border-[var(--enterprise-border)] bg-white"
        style={{ cursor: disabled ? "default" : "crosshair" }}
        aria-label="Signature pad"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--enterprise-text-muted)]">
          Sign above to acknowledge this inspection.
        </p>
        {hasInk && !disabled ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

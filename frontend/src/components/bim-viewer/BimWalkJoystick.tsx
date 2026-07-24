"use client";

import { useRef } from "react";

/** Virtual joystick for walk mode (touch and mouse). Size comes from CSS `--bim-joystick-*` tokens. */
export function BimWalkJoystick(props: { onChange: (forward: number, strafe: number) => void }) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointer = useRef<number | null>(null);

  function padMetrics() {
    const pad = padRef.current;
    const knob = knobRef.current;
    if (!pad || !knob) return { range: 32, knobHalf: 24 };
    const padSize = pad.offsetWidth;
    const knobSize = knob.offsetWidth;
    return { range: Math.max(8, (padSize - knobSize) / 2), knobHalf: knobSize / 2 };
  }

  function moveKnob(clientX: number, clientY: number) {
    const pad = padRef.current;
    const knob = knobRef.current;
    if (!pad || !knob) return;
    const { range } = padMetrics();
    const rect = pad.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > range) {
      dx = (dx / len) * range;
      dy = (dy / len) * range;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    props.onChange(-dy / range, dx / range);
  }

  function reset() {
    activePointer.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    props.onChange(0, 0);
  }

  return (
    <div
      ref={padRef}
      role="application"
      aria-label="Walk joystick — drag to move"
      className="bim-walk-joystick bim-glass-surface mobile-touch-target"
      onPointerDown={(e) => {
        activePointer.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        moveKnob(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        moveKnob(e.clientX, e.clientY);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <div ref={knobRef} className="bim-walk-joystick__knob" aria-hidden />
    </div>
  );
}

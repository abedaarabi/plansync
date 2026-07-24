"use client";

import { useEffect, useState } from "react";
import type { BimEngine } from "./bimEngine";
import { isCoarsePointer } from "@/lib/bim/viewportPixelRatio";
import { BimWalkJoystick } from "./BimWalkJoystick";
import { BimWalkPlanMap } from "./BimWalkPlanMap";

/** Walk-mode HUD: hint, plan map, and joystick — fixed above viewer chrome. */
export function BimWalkChrome(props: {
  engine: BimEngine | null;
  onJoystickChange: (forward: number, strafe: number) => void;
}) {
  const [touchDevice, setTouchDevice] = useState(false);

  useEffect(() => {
    setTouchDevice(isCoarsePointer());
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouchDevice(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="bim-walk-chrome" role="region" aria-label="Walk mode controls">
      <p className="bim-walk-chrome__hint bim-glass-surface">
        {touchDevice
          ? "Drag to look · joystick to move · pinch to zoom"
          : "Walk mode — drag to look, WASD or joystick to move"}
      </p>
      <BimWalkPlanMap engine={props.engine} />
      <BimWalkJoystick onChange={props.onJoystickChange} />
    </div>
  );
}

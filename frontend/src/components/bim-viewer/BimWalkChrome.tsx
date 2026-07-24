"use client";

import { useEffect, useState } from "react";
import { isCoarsePointer } from "@/lib/bim/viewportPixelRatio";
import { BimWalkJoystick } from "./BimWalkJoystick";

/** Walk-mode HUD: hint and joystick — fixed above viewer chrome. */
export function BimWalkChrome(props: {
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
      <BimWalkJoystick onChange={props.onJoystickChange} />
    </div>
  );
}

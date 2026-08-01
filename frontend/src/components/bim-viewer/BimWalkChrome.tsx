"use client";

import { useEffect, useState } from "react";
import { isTouchPrimaryDevice } from "@/lib/bim/viewportPixelRatio";
import { BimWalkJoystick } from "./BimWalkJoystick";

/** Walk-mode HUD: virtual joystick on phone/iPad only. */
export function BimWalkChrome(props: {
  onJoystickChange: (forward: number, strafe: number) => void;
}) {
  const [showJoystick, setShowJoystick] = useState(false);

  useEffect(() => {
    const sync = () => setShowJoystick(isTouchPrimaryDevice());
    sync();
    const coarse = window.matchMedia("(pointer: coarse)");
    const hover = window.matchMedia("(hover: none)");
    const width = window.matchMedia("(max-width: 1366px)");
    coarse.addEventListener("change", sync);
    hover.addEventListener("change", sync);
    width.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      hover.removeEventListener("change", sync);
      width.removeEventListener("change", sync);
    };
  }, []);

  if (!showJoystick) return null;

  return (
    <div className="bim-walk-chrome" role="region" aria-label="Walk mode controls">
      <BimWalkJoystick onChange={props.onJoystickChange} />
    </div>
  );
}

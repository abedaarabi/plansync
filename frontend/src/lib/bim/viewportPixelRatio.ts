/** Device pixel ratio cap for the BIM WebGL viewport — balances sharpness vs GPU/memory on phones/tablets. */
// fallow-ignore-next-line complexity
export function bimViewportPixelRatio(): number {
  if (typeof window === "undefined") return 1;

  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const tablet = window.matchMedia("(max-width: 1023px)").matches;
  const phone = window.matchMedia("(max-width: 639px)").matches;

  if (phone && coarse) return Math.min(dpr, 1.35);
  if (tablet && coarse) return Math.min(dpr, 1.5);
  if (coarse) return Math.min(dpr, 1.75);
  return Math.min(dpr, 2);
}

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Walk joystick / touch HUD: phones, iPads, and other touch-primary devices.
 * Includes iPads that report a fine pointer when a trackpad is attached.
 */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (isCoarsePointer()) return true;
  if (window.matchMedia("(hover: none)").matches) return true;
  // iPad-class: multi-touch + tablet-ish width (even with Magic Keyboard).
  return navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 1366px)").matches;
}

/** Light tap feedback on supported devices (Android / some PWAs). No-op elsewhere. */
export function hapticTap(durationMs = 10): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(durationMs);
  }
}

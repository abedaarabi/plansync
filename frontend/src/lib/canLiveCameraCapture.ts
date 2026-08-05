/** True when getUserMedia live capture is available in this browser context. */
export function canLiveCameraCapture(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (window.isSecureContext === true ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost")
  );
}

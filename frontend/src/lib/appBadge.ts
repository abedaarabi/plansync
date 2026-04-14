/**
 * PWA / installed app icon badge (Badging API).
 * Supported on Chromium installed PWAs and some other browsers; Safari support varies.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/setAppBadge
 */

const BADGE_CAP = 99;

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function nav(): NavigatorWithBadge | null {
  if (typeof navigator === "undefined") return null;
  return navigator as NavigatorWithBadge;
}

/** Updates the app icon badge from unread in-app notification count. No-op if unsupported. */
export function syncAppBadgeFromUnreadCount(unreadCount: number): void {
  if (typeof window === "undefined" || !window.isSecureContext) return;
  const n = nav();
  if (!n?.setAppBadge) return;

  void (async () => {
    try {
      if (unreadCount > 0) {
        const value = Math.min(BADGE_CAP, unreadCount);
        await n.setAppBadge!(value);
      } else if (typeof n.clearAppBadge === "function") {
        await n.clearAppBadge();
      }
    } catch {
      /* optional API — ignore */
    }
  })();
}

/** Clears the app icon badge (e.g. on sign-out). */
export function clearAppBadgeSafe(): void {
  if (typeof window === "undefined" || !window.isSecureContext) return;
  const n = nav();
  if (typeof n?.clearAppBadge !== "function") return;
  void n.clearAppBadge().catch(() => {
    /* ignore */
  });
}

export function isAppBadgeSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof (navigator as NavigatorWithBadge).setAppBadge === "function"
  );
}

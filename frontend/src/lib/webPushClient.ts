import {
  fetchVapidPublicKey,
  postWebPushSubscribe,
  postWebPushUnsubscribe,
} from "@/lib/api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupportedInBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    window.isSecureContext
  );
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupportedInBrowser()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type WebPushEnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "no_key" | "denied" | "dismissed" | "error";
      message?: string;
    };

/**
 * Subscribe this browser and register with the API. Call after the user enables notifications.
 * iOS: only works for Add to Home Screen Web Apps (16.4+).
 */
export async function enableWebPushOnDevice(): Promise<WebPushEnableResult> {
  if (!isWebPushSupportedInBrowser()) {
    return { ok: false, reason: "unsupported" };
  }
  const perm = await Notification.requestPermission();
  if (perm === "denied") return { ok: false, reason: "denied" };
  if (perm !== "granted") return { ok: false, reason: "dismissed" };

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "no_key" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const keyBuffer = urlBase64ToUint8Array(publicKey);
    const appServerKey = new Uint8Array(keyBuffer);
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    } else {
      const json = sub.toJSON();
      const keys = json.keys as { p256dh?: string; auth?: string } | undefined;
      if (!keys?.p256dh || !keys?.auth) {
        await sub.unsubscribe();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });
      }
    }
    const payload = sub.toJSON();
    if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
      return { ok: false, reason: "error", message: "Invalid subscription from browser." };
    }
    await postWebPushSubscribe({
      endpoint: payload.endpoint,
      keys: { p256dh: payload.keys.p256dh, auth: payload.keys.auth },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}

export async function disableWebPushOnDevice(): Promise<void> {
  if (!isWebPushSupportedInBrowser()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* still try API delete */
  }
  await postWebPushUnsubscribe(endpoint);
}

"use client";

import { useEffect, useState } from "react";
import {
  disableWebPushOnDevice,
  enableWebPushOnDevice,
  getExistingPushSubscription,
  isWebPushSupportedInBrowser,
} from "@/lib/webPushClient";

/**
 * Web Push opt-in for the signed-in user on this browser / installed PWA.
 */
export function AccountDeviceAlerts() {
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOnDevice, setPushOnDevice] = useState<boolean | null>(null);
  const [pushHint, setPushHint] = useState<string | null>(null);

  useEffect(() => {
    setPushHint(null);
    void (async () => {
      if (!isWebPushSupportedInBrowser()) {
        setPushOnDevice(false);
        return;
      }
      const s = await getExistingPushSubscription();
      setPushOnDevice(Boolean(s));
    })();
  }, []);

  return (
    <div className="enterprise-card p-5">
      <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Alerts on this device</h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
        Get a ping when something new happens in your projects—RFI updates, punch assignments,
        issues, proposals, and the same items as the bell in the header. On iPhone, add PlanSync to
        your Home Screen for the best experience.
      </p>
      {!pushOnDevice && isWebPushSupportedInBrowser() ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
          Your browser will ask to allow alerts—that step is required so we can reach you when you
          are not inside the app.
        </p>
      ) : null}
      {pushHint ? (
        <p className="mt-2 text-xs text-amber-800" role="status">
          {pushHint}
        </p>
      ) : null}
      <div className="mt-4">
        {!isWebPushSupportedInBrowser() ? (
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Alerts on this device are not available here (try Chrome, or install the app from Safari
            on iPhone).
          </p>
        ) : pushOnDevice ? (
          <button
            type="button"
            disabled={pushBusy}
            onClick={() => {
              setPushBusy(true);
              setPushHint(null);
              void (async () => {
                try {
                  await disableWebPushOnDevice();
                  setPushOnDevice(false);
                } catch {
                  setPushHint("Could not turn off alerts on this device.");
                } finally {
                  setPushBusy(false);
                }
              })();
            }}
            className="w-full rounded-lg border border-[var(--enterprise-border)] bg-white py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pushBusy ? "Working…" : "Stop alerts on this device"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pushBusy || pushOnDevice === null}
            onClick={() => {
              setPushBusy(true);
              setPushHint(null);
              void (async () => {
                const r = await enableWebPushOnDevice();
                if (r.ok) {
                  setPushOnDevice(true);
                } else if (r.reason === "denied") {
                  setPushHint(
                    "Alerts are blocked for this site. Turn them on in browser settings if you want pings for new activity.",
                  );
                } else if (r.reason === "dismissed") {
                  setPushHint("No problem—you can try again when you want updates on this device.");
                } else if (r.reason === "no_key") {
                  setPushHint("Alerts on this device are not set up on the server yet.");
                } else if (r.reason === "unsupported") {
                  setPushHint("This browser does not support alerts on this device.");
                } else {
                  setPushHint(r.message ?? "Could not turn on alerts on this device.");
                }
                setPushBusy(false);
              })();
            }}
            className="w-full rounded-lg bg-[var(--enterprise-primary)] py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            {pushBusy ? "Working…" : "Get alerts on this device"}
          </button>
        )}
      </div>
    </div>
  );
}

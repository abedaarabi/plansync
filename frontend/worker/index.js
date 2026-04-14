/* global self */

/** @param {Record<string, unknown>} data */
function safeString(v, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }

  const title = safeString(data.title, "PlanSync");
  const body = safeString(data.body, "");
  const rawUrl = data.url;
  const url =
    typeof rawUrl === "string" && (rawUrl.startsWith("http") || rawUrl.startsWith("/"))
      ? rawUrl
      : `${self.location.origin}/`;

  const tag = typeof data.tag === "string" && data.tag.length > 0 ? data.tag : undefined;
  const ts =
    typeof data.timestamp === "number" && Number.isFinite(data.timestamp)
      ? data.timestamp
      : Date.now();

  const options = {
    body: body || "Open in PlanSync",
    tag,
    timestamp: ts,
    data: { url, kind: typeof data.kind === "string" ? data.kind : "" },
    icon: `${self.location.origin}/icons/icon-512.png`,
    badge: `${self.location.origin}/icons/icon-192.png`,
    vibrate: [180, 80, 180],
    requireInteraction: false,
    silent: false,
    renotify: true,
    dir: "auto",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const raw = d.url;
  let targetUrl = `${self.location.origin}/`;
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) {
      try {
        const u = new URL(t);
        if (u.origin === self.location.origin) targetUrl = u.href;
      } catch {
        /* keep default */
      }
    } else if (t.startsWith("/") && !t.startsWith("//")) {
      targetUrl = `${self.location.origin}${t}`;
    }
  }

  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const targetOrigin = new URL(targetUrl).origin;
      for (const client of clientsArr) {
        try {
          if (new URL(client.url).origin !== targetOrigin) continue;
          await client.focus();
          if (typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
              return;
            } catch {
              /* fall through */
            }
          }
          return;
        } catch {
          continue;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

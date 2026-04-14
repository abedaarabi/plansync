/* global self */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }
  const title =
    typeof data.title === "string" && data.title.trim() ? data.title.trim() : "PlanSync";
  const body = typeof data.body === "string" ? data.body : undefined;
  const url =
    typeof data.url === "string" && (data.url.startsWith("http") || data.url.startsWith("/"))
      ? data.url
      : `${self.location.origin}/`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
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

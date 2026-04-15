(() => {
  function t(i, n = "") {
    return "string" == typeof i && i.trim() ? i.trim() : n;
  }
  (self.addEventListener("push", (i) => {
    let n = {};
    try {
      n = i.data ? i.data.json() : {};
    } catch {}
    let e = t(n.title, "PlanSync"),
      o = t(n.body, ""),
      a = n.url,
      r =
        "string" == typeof a && (a.startsWith("http") || a.startsWith("/"))
          ? a
          : `${self.location.origin}/`,
      s = {
        body: o || "Open in PlanSync",
        tag: "string" == typeof n.tag && n.tag.length > 0 ? n.tag : void 0,
        timestamp:
          "number" == typeof n.timestamp && Number.isFinite(n.timestamp) ? n.timestamp : Date.now(),
        data: { url: r, kind: "string" == typeof n.kind ? n.kind : "" },
        icon: `${self.location.origin}/icons/icon-512.png`,
        badge: `${self.location.origin}/icons/icon-192.png`,
        vibrate: [180, 80, 180],
        requireInteraction: !1,
        silent: !1,
        renotify: !0,
        dir: "auto",
      };
    i.waitUntil(self.registration.showNotification(e, s));
  }),
    self.addEventListener("notificationclick", (t) => {
      t.notification.close();
      let i = (t.notification.data || {}).url,
        n = `${self.location.origin}/`;
      if ("string" == typeof i && i.trim()) {
        let t = i.trim();
        if (t.startsWith("http://") || t.startsWith("https://"))
          try {
            let i = new URL(t);
            i.origin === self.location.origin && (n = i.href);
          } catch {}
        else t.startsWith("/") && !t.startsWith("//") && (n = `${self.location.origin}${t}`);
      }
      t.waitUntil(
        (async () => {
          let t = await self.clients.matchAll({ type: "window", includeUncontrolled: !0 }),
            i = new URL(n).origin;
          for (let e of t)
            try {
              if (new URL(e.url).origin !== i) continue;
              if ((await e.focus(), "function" == typeof e.navigate))
                try {
                  await e.navigate(n);
                } catch {}
              return;
            } catch {
              continue;
            }
          await self.clients.openWindow(n);
        })(),
      );
    }));
})();

import webpush from "web-push";
import type { Env } from "./env.js";
import { prisma } from "./prisma.js";

let vapidApplied = false;

export function isWebPushConfigured(env: Env): boolean {
  return Boolean(
    env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim() && env.VAPID_SUBJECT?.trim(),
  );
}

function ensureVapid(env: Env): boolean {
  const pub = env.VAPID_PUBLIC_KEY?.trim();
  const priv = env.VAPID_PRIVATE_KEY?.trim();
  const subj = env.VAPID_SUBJECT?.trim();
  if (!pub || !priv || !subj) return false;
  if (!vapidApplied) {
    webpush.setVapidDetails(subj, pub, priv);
    vapidApplied = true;
  }
  return true;
}

export function absoluteAppUrl(env: Env, href: string): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${base}${path}`;
}

export async function sendWebPushForUsers(opts: {
  env: Env;
  userIds: string[];
  title: string;
  body: string | null;
  href: string;
}): Promise<void> {
  if (!ensureVapid(opts.env)) return;
  const url = absoluteAppUrl(opts.env, opts.href);
  const ids = [...new Set(opts.userIds)].filter(Boolean);
  if (ids.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: ids } },
  });
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body ?? "",
    url,
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 });
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
        } else {
          console.error("[web-push]", e);
        }
      }
    }),
  );
}

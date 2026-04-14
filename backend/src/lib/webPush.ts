import { createHash } from "node:crypto";
import webpush from "web-push";
import type { Env } from "./env.js";
import { prisma } from "./prisma.js";

/** Short line for push body (shown under the title in the service worker). */
export function pushKindCategoryLabel(kind: string): string {
  const labels: Record<string, string> = {
    RFI_MESSAGE: "RFI",
    RFI_ASSIGNED: "RFI",
    RFI_REOPENED: "RFI",
    RFI_REVIEW: "RFI",
    RFI_RESPONSE: "RFI",
    RFI_CLOSED: "RFI",
    RFI_OVERDUE: "RFI",
    PUNCH_ASSIGNED: "Punch list",
    ISSUE_ASSIGNED: "Site issue",
    HANDOVER_FM: "O&M handover",
    ISSUE_CREATED: "O&M request",
    PROPOSAL_VIEWED: "Proposal",
    PROPOSAL_ACCEPTED: "Proposal",
    PROPOSAL_DECLINED: "Proposal",
    PROPOSAL_CHANGE_REQUESTED: "Proposal",
  };
  return labels[kind] ?? "PlanSync";
}

const PUSH_BODY_MAX = 320;

function buildPushDisplayBody(categoryLabel: string, detail: string | null): string {
  const d = detail?.trim() ?? "";
  const line = d.length > 0 ? `${categoryLabel}\n${d}` : categoryLabel;
  return line.length <= PUSH_BODY_MAX ? line : `${line.slice(0, PUSH_BODY_MAX - 1)}…`;
}

function pushNotificationTag(kind: string, href: string): string {
  const h = createHash("sha256").update(`${kind}:${href}`).digest("hex").slice(0, 24);
  return `plansync-${h}`;
}

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
  kind: string;
}): Promise<void> {
  if (!ensureVapid(opts.env)) return;
  const url = absoluteAppUrl(opts.env, opts.href);
  const ids = [...new Set(opts.userIds)].filter(Boolean);
  if (ids.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: ids } },
  });
  if (subs.length === 0) return;

  const categoryLabel = pushKindCategoryLabel(opts.kind);
  const displayBody = buildPushDisplayBody(categoryLabel, opts.body);
  const tag = pushNotificationTag(opts.kind, opts.href);
  const timestamp = Date.now();

  const payload = JSON.stringify({
    title: opts.title.trim() || "PlanSync",
    body: displayBody,
    url,
    kind: opts.kind,
    categoryLabel,
    tag,
    timestamp,
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

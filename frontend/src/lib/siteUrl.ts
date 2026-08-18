import { headers } from "next/headers";

/** Public 3D viewer screenshot for Open Graph / Twitter cards (`frontend/public`). */
export const SITE_SHARE_IMAGE = {
  path: "/images/3dviewer-og.jpg",
  file: "public/images/3dviewer-og.jpg",
  width: 1280,
  height: 725,
  type: "image/jpeg",
} as const;

const PRODUCTION_SITE_ORIGIN = "https://plansync.dev";
const LOCAL_SITE_ORIGIN = "http://localhost:3000";

function firstEnvOrigin(keys: readonly string[]): string | null {
  for (const key of keys) {
    const raw = process.env[key]?.trim().replace(/\/$/, "");
    if (!raw) continue;
    const origin = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      new URL(origin);
      return origin;
    } catch {
      continue;
    }
  }
  return null;
}

function originFromEnv(): string | null {
  const explicit = firstEnvOrigin([
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_APP_URL",
    "PUBLIC_APP_URL",
  ]);
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

function fallbackOrigin(): string {
  return process.env.NODE_ENV === "production" ? PRODUCTION_SITE_ORIGIN : LOCAL_SITE_ORIGIN;
}

/**
 * Canonical site origin for metadata (Open Graph, Twitter cards, canonical URLs).
 * Prefer `PUBLIC_APP_URL` at runtime in Docker (NEXT_PUBLIC_* is inlined at build and is often empty).
 */
export function getSiteOrigin(): string {
  return originFromEnv() ?? fallbackOrigin();
}

/**
 * Same as {@link getSiteOrigin} but, when env is unset, derives the public URL from the incoming
 * request (reverse-proxy headers). Use this for sitemap / robots / share metadata so Docker + Traefik
 * show https://yourdomain.com instead of http://localhost:3000 without a rebuild.
 */
export async function getSiteOriginFromRequest(): Promise<string> {
  const fromEnv = originFromEnv();
  if (fromEnv) return fromEnv;

  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host");
  if (rawHost) {
    const host = rawHost.split(",")[0].trim();
    const rawProto = h.get("x-forwarded-proto")?.split(",")[0].trim();
    const local =
      host.startsWith("localhost") || host.startsWith("127.") || host.endsWith(".local");
    const proto = rawProto || (local ? "http" : "https");
    return `${proto}://${host}`;
  }

  return fallbackOrigin();
}

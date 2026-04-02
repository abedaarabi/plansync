import { headers } from "next/headers";

function originFromEnv(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

/**
 * Canonical site origin for metadata (Open Graph, Twitter cards, canonical URLs).
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://plansync.example.com).
 * Vercel sets VERCEL_URL automatically; standalone Docker builds should pass NEXT_PUBLIC_SITE_URL at build time.
 */
export function getSiteOrigin(): string {
  return originFromEnv() ?? "http://localhost:3000";
}

/**
 * Same as {@link getSiteOrigin} but, when env is unset, derives the public URL from the incoming
 * request (reverse-proxy headers). Use this for sitemap / robots so Docker + Traefik/Caddy show
 * https://yourdomain.com instead of http://localhost:3000 without a rebuild.
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

  return "http://localhost:3000";
}

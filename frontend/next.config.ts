import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import withPWAInit from "@ducanh2912/next-pwa";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(configDir, "..");
/** Repo root env — `.env`, `.env.prod`, then `.env.local` (local overrides; same order as backend / Prisma). */
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.prod") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  /** Avoid precaching very large marketing assets */
  publicExcludes: ["!images/**/*"],
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    /** Pro / job-site: prefer cached shell when offline; PDF bytes still come from network or IndexedDB in-app */
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/viewer"),
        handler: "NetworkFirst",
        options: {
          cacheName: "plansync-viewer-pages",
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /** Hide bottom-left dev “N” indicator in development (not shown in production). */
  devIndicators: false,
  output: "standalone",
  /** Monorepo: trace from repo root (`frontend` sits directly under root). */
  outputFileTracingRoot: path.join(configDir, ".."),
  /** Next 16 defaults `next dev` to Turbopack; @ducanh2912/next-pwa injects webpack. Acknowledge both. */
  turbopack: {},
  /**
   * `/api/*` is proxied to Hono via `app/api/[[...path]]/route.ts` (not rewrites) so multiple
   * `Set-Cookie` headers from Better Auth are forwarded correctly in production.
   */
};

export default withPWA(nextConfig);

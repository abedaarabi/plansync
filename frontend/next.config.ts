import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import withPWAInit from "@ducanh2912/next-pwa";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(configDir, "..");
/** Repo root env — `.env`, `.env.prod`, then `.env.local` (local overrides; same order as backend / Prisma). */
const portBeforeEnvLoad = process.env.PORT;
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.prod") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });
/**
 * Root `.env.local` sets `PORT` for the backend (8787). If it leaks into this
 * process, `next dev` auto-restarts (config changes) bind the backend's port
 * instead of 3000. Keep whatever PORT the frontend was actually started with.
 */
if (portBeforeEnvLoad !== process.env.PORT) {
  if (portBeforeEnvLoad === undefined) delete process.env.PORT;
  else process.env.PORT = portBeforeEnvLoad;
}

const withPWA = withPWAInit({
  dest: "public",
  /** Normal `next dev` (Turbopack): off. Use `npm run dev:pwa` or `npm run build && npm start` to test install / SW. */
  disable: process.env.NODE_ENV === "development" && process.env.PWA_IN_DEV !== "1",
  register: true,
  /** Avoid precaching very large marketing assets */
  publicExcludes: ["!images/**/*"],
  workboxOptions: {
    /**
     * Keep Workbox bundling stable with Next 16 webpack builds.
     * Production mode can intermittently hang in terser `renderChunk`.
     */
    mode: "development",
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
      /** Enterprise project shell (punch list, RFIs, etc.) — faster repeat visits / flaky site Wi‑Fi. */
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith("/projects/") && !url.pathname.includes("/files/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "plansync-project-pages",
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 12 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /** Hide bottom-left dev “N” indicator in development (not shown in production). */
  devIndicators: false,
  /** Allow `quality` values used by `next/image` (Next 16+ requires an explicit allowlist). */
  images: {
    qualities: [75, 82, 85, 90],
  },
  output: "standalone",
  /** Monorepo: trace from repo root (`frontend` sits directly under root). */
  outputFileTracingRoot: path.join(configDir, ".."),
  experimental: {
    /**
     * With `proxy.ts` present, Next buffers request bodies at 10MB by default,
     * truncating larger uploads (IFC models) before they reach the API route →
     * 502. Backend `MAX_DIRECT_UPLOAD_BYTES` is 100MB; keep this just above it
     * so the backend's own 413 stays authoritative.
     */
    proxyClientMaxBodySize: "110mb",
  },
  /** Next 16 defaults `next dev` to Turbopack; @ducanh2912/next-pwa injects webpack. Acknowledge both. */
  turbopack: {
    resolveAlias: {
      /** three's TTFLoader imports opentype.js from a CDN URL — unbundleable; unused (BIM viewer). */
      "three/examples/jsm/loaders/TTFLoader.js": "./src/lib/three-ttfloader-stub.js",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "three/examples/jsm/loaders/TTFLoader.js": path.join(
        configDir,
        "src/lib/three-ttfloader-stub.js",
      ),
    };
    return config;
  },
  /**
   * `/api/*` is proxied to Hono via `app/api/[[...path]]/route.ts` (not rewrites) so multiple
   * `Set-Cookie` headers from Better Auth are forwarded correctly in production.
   */
};

export default withPWA(nextConfig);

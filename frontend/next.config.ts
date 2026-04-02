import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import withPWAInit from "@ducanh2912/next-pwa";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(configDir, "..");
/** Repo root env — load `.env`, then optional `.env.prod` overrides (same as backend / Prisma scripts). */
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.prod") });

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

const apiProxy = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787";

const nextConfig: NextConfig = {
  output: "standalone",
  /** Monorepo: trace from repo root (`frontend` sits directly under root). */
  outputFileTracingRoot: path.join(configDir, ".."),
  /** Next 16 defaults `next dev` to Turbopack; @ducanh2912/next-pwa injects webpack. Acknowledge both. */
  turbopack: {},
  /** Proxy `/api/*` to Hono so Better Auth cookies stay on the app origin (see docs/api-proxy.md). */
  async rewrites() {
    return {
      beforeFiles: [{ source: "/api/:path*", destination: `${apiProxy}/api/:path*` }],
    };
  },
};

export default withPWA(nextConfig);

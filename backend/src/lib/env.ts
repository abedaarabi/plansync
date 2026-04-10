import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  /** Public API origin when the SPA calls `api.example.com` (e.g. Mintlify / OpenAPI). Mirror `NEXT_PUBLIC_API_URL` in production. */
  PUBLIC_API_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  /** Apex host for Better Auth session cookies across `app` + `api` subdomains (e.g. `plansync.dev`). */
  BETTER_AUTH_COOKIE_DOMAIN: z.string().optional(),
  /** Comma-separated extra `Origin` values allowed for CORS and Better Auth (e.g. Mintlify preview URL). */
  CORS_EXTRA_ORIGINS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  /** Max bytes for POST /files/upload (browser → API → S3; avoids S3 CORS). Default 100 MiB. */
  MAX_DIRECT_UPLOAD_BYTES: z.coerce.bigint().default(104857600n),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  /**
   * Stripe Checkout shows “Add promotion code” when true (default). Create Coupons + Promotion codes in the Dashboard.
   * Set to 0 / false / off / no to disable.
   */
  STRIPE_CHECKOUT_ALLOW_PROMOTION_CODES: z.preprocess((v) => {
    if (v === undefined || v === null || String(v).trim() === "") return true;
    const t = String(v).trim().toLowerCase();
    return t !== "0" && t !== "false" && t !== "off" && t !== "no";
  }, z.boolean()),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Optional secret for internal cron POST routes (header `x-plansync-cron-secret`), e.g.
   * `/api/v1/internal/rfi-overdue-reminders`, `/api/v1/internal/om-maintenance-reminders`.
   */
  INTERNAL_CRON_SECRET: z.string().optional(),

  /** OAuth — optional; set both id + secret to enable each provider */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** OneDrive import (Graph). Register redirect: `{BETTER_AUTH_URL}/api/v1/cloud/microsoft/callback` */
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  /** Dropbox import. Register redirect: `{BETTER_AUTH_URL}/api/v1/cloud/dropbox/callback` */
  DROPBOX_APP_KEY: z.string().optional(),
  DROPBOX_APP_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),

  /** Google Gemini (Sheet AI). Use `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`. */
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /**
   * Vision model for Sheet AI. Default is Flash (~much cheaper than Pro for image+text).
   * Use `gemini-2.5-pro` when you need maximum TOC/region accuracy (expect roughly several× higher cost).
   */
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  /**
   * PDF viewer live collaboration (SSE/WebSocket). Set to `0`, `false`, `off`, or `no` to disable
   * globally (workspace flags are ignored when off).
   */
  COLLABORATION_ENABLED: z.preprocess((v) => {
    if (v === undefined || v === null || String(v).trim() === "") return true;
    const t = String(v).trim().toLowerCase();
    return t !== "0" && t !== "false" && t !== "off" && t !== "no";
  }, z.boolean()),
});

export type Env = z.infer<typeof schema>;

export function buildCorsAllowList(env: Env): string[] {
  const list = [env.CORS_ORIGIN, env.PUBLIC_APP_URL];
  if (env.PUBLIC_API_URL?.trim()) list.push(env.PUBLIC_API_URL.trim());
  if (env.CORS_EXTRA_ORIGINS?.trim()) {
    for (const o of env.CORS_EXTRA_ORIGINS.split(",")) {
      const t = o.trim();
      if (t) list.push(t);
    }
  }
  return [...new Set(list.filter(Boolean))];
}

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

/** Resolved API key for Gemini (Sheet AI). */
export function resolveGeminiApiKey(env: Env): string | undefined {
  const a = env.GEMINI_API_KEY?.trim();
  if (a) return a;
  const b = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return b || undefined;
}

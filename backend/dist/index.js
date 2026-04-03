import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Monorepo root — `.env`, `.env.prod`, `backend/.env`, then `.env.local` (local overrides)
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../.env.prod") });
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../.env.local"), override: true });
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildCorsAllowList, loadEnv, resolveGeminiApiKey } from "./lib/env.js";
import { createAuth } from "./auth.js";
import { v1Routes } from "./routes/v1/index.js";
import { stripeRoutes } from "./routes/stripe.js";
const env = loadEnv();
if (resolveGeminiApiKey(env)) {
    const m = env.GEMINI_MODEL.trim() || "gemini-2.5-pro";
    console.log(`[sheet-ai] Gemini model: ${m}`);
}
const auth = createAuth(env);
const app = new Hono();
const corsOrigins = buildCorsAllowList(env);
app.use("*", cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
}));
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/stripe", stripeRoutes(env));
app.route("/api/v1", v1Routes(auth, env));
app.get("/", (c) => c.json({ ok: true, service: "plansync-api" }));
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    // Inside Docker this is the container port; Traefik/DNS expose PUBLIC_API_URL / api host.
    const publicApi = env.PUBLIC_API_URL?.trim() || "(unset — set PUBLIC_API_URL or NEXT_PUBLIC_API_URL in compose)";
    console.log(`API listening on :${info.port} (public API origin: ${publicApi}; app: ${env.PUBLIC_APP_URL})`);
});

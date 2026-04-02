import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Monorepo root — `.env` then `.env.prod` (shared with Next / Prisma)
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../.env.prod") });
config({ path: resolve(__dirname, "../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildCorsAllowList, loadEnv } from "./lib/env.js";
import { createAuth } from "./auth.js";
import { v1Routes } from "./routes/v1/index.js";
import { stripeRoutes } from "./routes/stripe.js";

const env = loadEnv();
const auth = createAuth(env);

const app = new Hono();

const corsOrigins = buildCorsAllowList(env);

app.use(
  "*",
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0]! : corsOrigins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/stripe", stripeRoutes(env));
app.route("/api/v1", v1Routes(auth, env));

app.get("/", (c) => c.json({ ok: true, service: "plansync-api" }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

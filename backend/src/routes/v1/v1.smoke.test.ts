import { describe, expect, it } from "vitest";
import { v1Routes } from "./index.js";
import type { Env } from "../../lib/env.js";

/** Minimal env for route smoke tests (no real DB or network). */
function testEnv(): Env {
  return {
    NODE_ENV: "test",
    PORT: 8787,
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/plansync_test",
    CORS_ORIGIN: "http://localhost:3000",
    PUBLIC_APP_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "test-secret-not-for-production-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    MAX_DIRECT_UPLOAD_BYTES: 104857600n,
    GEMINI_MODEL: "gemini-2.5-pro",
    COLLABORATION_ENABLED: true,
    STRIPE_CHECKOUT_ALLOW_PROMOTION_CODES: true,
  };
}

const mockAuth = {
  api: {
    getSession: async () => null,
  },
};

describe("v1 API smoke", () => {
  it("GET /health returns ok", async () => {
    const app = v1Routes(mockAuth, testEnv());
    const res = await app.request("http://localhost/health", { method: "GET" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("BIM file-version routes require auth (no anonymous cross-tenant reads)", async () => {
    const app = v1Routes(mockAuth, testEnv());
    const res = await app.request("http://localhost/file-versions/fv_x/bim/status", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("file upload routes require auth", async () => {
    const app = v1Routes(mockAuth, testEnv());
    const res = await app.request("http://localhost/files/presign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws",
        projectId: "p",
        fileName: "a.pdf",
        sizeBytes: 1,
      }),
    });
    expect(res.status).toBe(401);
  });
});

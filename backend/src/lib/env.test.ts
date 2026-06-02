import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "./env.js";

const REQUIRED = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/plansync_test",
  BETTER_AUTH_SECRET: "test-secret-not-for-production-123",
  PUBLIC_APP_URL: "https://plansync.dev",
  CORS_ORIGIN: "https://plansync.dev",
};

describe("loadEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes BETTER_AUTH_URL to PUBLIC_APP_URL in production when pointed at API host", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", REQUIRED.DATABASE_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", REQUIRED.BETTER_AUTH_SECRET);
    vi.stubEnv("PUBLIC_APP_URL", REQUIRED.PUBLIC_APP_URL);
    vi.stubEnv("CORS_ORIGIN", REQUIRED.CORS_ORIGIN);
    vi.stubEnv("PUBLIC_API_URL", "https://api.plansync.dev");
    vi.stubEnv("BETTER_AUTH_URL", "https://api.plansync.dev");

    expect(loadEnv().BETTER_AUTH_URL).toBe("https://plansync.dev");
  });

  it("keeps BETTER_AUTH_URL unchanged in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", REQUIRED.DATABASE_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", REQUIRED.BETTER_AUTH_SECRET);
    vi.stubEnv("PUBLIC_APP_URL", REQUIRED.PUBLIC_APP_URL);
    vi.stubEnv("CORS_ORIGIN", REQUIRED.CORS_ORIGIN);
    vi.stubEnv("BETTER_AUTH_URL", "https://api.plansync.dev");

    expect(loadEnv().BETTER_AUTH_URL).toBe("https://api.plansync.dev");
  });
});

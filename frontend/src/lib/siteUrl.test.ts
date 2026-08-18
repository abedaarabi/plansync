import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteOrigin, SITE_SHARE_IMAGE } from "./siteUrl";

describe("getSiteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plansync.dev");
    vi.stubEnv("PUBLIC_APP_URL", "https://ignored.example");
    expect(getSiteOrigin()).toBe("https://plansync.dev");
  });

  it("uses PUBLIC_APP_URL when NEXT_PUBLIC_SITE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("PUBLIC_APP_URL", "https://plansync.dev/");
    expect(getSiteOrigin()).toBe("https://plansync.dev");
  });

  it("does not emit localhost in production when env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(getSiteOrigin()).toBe("https://plansync.dev");
  });
});

describe("SITE_SHARE_IMAGE", () => {
  it("points at the public 3D viewer JPEG", () => {
    expect(SITE_SHARE_IMAGE.path).toBe("/images/3dviewer-og.jpg");
    expect(SITE_SHARE_IMAGE.width).toBeGreaterThanOrEqual(1200);
    expect(SITE_SHARE_IMAGE.height).toBeGreaterThanOrEqual(630);
  });
});

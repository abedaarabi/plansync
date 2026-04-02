import { describe, expect, it, vi, afterEach } from "vitest";
import { apiUrl, getPublicApiBaseUrl } from "./api-url";

describe("api-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("apiUrl returns same-origin path when NEXT_PUBLIC_API_URL is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(apiUrl("/api/v1/health")).toBe("/api/v1/health");
  });

  it("apiUrl prefixes path when NEXT_PUBLIC_API_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    expect(apiUrl("/api/v1/health")).toBe("https://api.example.com/api/v1/health");
  });

  it("apiUrl strips trailing slash from base", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/");
    expect(apiUrl("/api/foo")).toBe("https://api.example.com/api/foo");
  });

  it("apiUrl rejects paths not starting with /api/", () => {
    expect(() => apiUrl("/v1/health")).toThrow(/must start with \/api\//);
  });

  it("getPublicApiBaseUrl returns empty string when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(getPublicApiBaseUrl()).toBe("");
  });
});

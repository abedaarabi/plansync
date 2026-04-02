import { describe, expect, it } from "vitest";
import { userInitials } from "./user-initials";

describe("userInitials", () => {
  it("uses first letters of two-word name", () => {
    expect(userInitials("Jane Doe", null)).toBe("JD");
  });

  it("uses first two letters of single word name", () => {
    expect(userInitials("Acme", null)).toBe("AC");
  });

  it("falls back to email local part", () => {
    expect(userInitials(null, "sam@example.com")).toBe("SA");
  });

  it("returns question mark when no usable input", () => {
    expect(userInitials(null, null)).toBe("?");
  });
});

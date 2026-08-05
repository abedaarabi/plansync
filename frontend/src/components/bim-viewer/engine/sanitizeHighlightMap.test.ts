import { describe, expect, it } from "vitest";
import { sanitizeHighlightMap } from "./sanitizeHighlightMap";

describe("sanitizeHighlightMap", () => {
  it("returns null for missing map or empty loaded set", () => {
    expect(sanitizeHighlightMap(null, new Set(["m1"]))).toBeNull();
    expect(sanitizeHighlightMap({ m1: new Set([1]) }, null)).toBeNull();
    expect(sanitizeHighlightMap({ m1: new Set([1]) }, new Set())).toBeNull();
  });

  it("keeps only loaded models with non-empty id sets", () => {
    const map = {
      m1: new Set([1, 2]),
      m2: new Set([9]),
      m3: new Set<number>(),
      m4: [1, 2] as unknown as Set<number>,
    };
    const out = sanitizeHighlightMap(map, new Set(["m1", "m3", "m4"]));
    expect(out).toEqual({ m1: new Set([1, 2]) });
    expect(out).not.toBe(map);
    expect(out?.m1).not.toBe(map.m1);
  });

  it("returns null when every entry is dropped", () => {
    expect(sanitizeHighlightMap({ gone: new Set([1]) }, new Set(["m1"]))).toBeNull();
  });
});

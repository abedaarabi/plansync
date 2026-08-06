import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countOpenWorkOrdersByAssetId,
  getAssetOpenWoCount,
  setAssetOpenWoCounts,
  subscribeAssetOpenWoCounts,
} from "./assetOpenWoCountsBridge";

describe("countOpenWorkOrdersByAssetId", () => {
  it("counts only open/in-progress rows with an asset", () => {
    expect(
      countOpenWorkOrdersByAssetId([
        { assetId: "a1", status: "OPEN" },
        { assetId: "a1", status: "IN_PROGRESS" },
        { assetId: "a1", status: "CLOSED" },
        { assetId: "a2", status: "OPEN" },
        { assetId: null, status: "OPEN" },
      ]),
    ).toEqual({ a1: 2, a2: 1 });
  });
});

describe("assetOpenWoCountsBridge", () => {
  afterEach(() => {
    setAssetOpenWoCounts({});
  });

  it("returns 0 for missing assets", () => {
    expect(getAssetOpenWoCount(null)).toBe(0);
    expect(getAssetOpenWoCount("missing")).toBe(0);
  });

  it("stores counts and notifies subscribers", () => {
    const spy = vi.fn();
    const unsub = subscribeAssetOpenWoCounts(spy);
    setAssetOpenWoCounts({ a1: 2, a2: 1 });
    expect(getAssetOpenWoCount("a1")).toBe(2);
    expect(getAssetOpenWoCount("a2")).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
    setAssetOpenWoCounts({ a1: 9 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(getAssetOpenWoCount("a1")).toBe(9);
  });
});

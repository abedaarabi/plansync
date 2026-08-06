import { describe, expect, it } from "vitest";
import { seatOverageQuantity } from "./seatPressure.js";

describe("seatOverageQuantity", () => {
  it("is zero at or below included seats", () => {
    expect(seatOverageQuantity(0, 10)).toBe(0);
    expect(seatOverageQuantity(10, 10)).toBe(0);
  });

  it("returns seats above the included pack", () => {
    expect(seatOverageQuantity(12, 10)).toBe(2);
    expect(seatOverageQuantity(7, 5)).toBe(2);
  });
});

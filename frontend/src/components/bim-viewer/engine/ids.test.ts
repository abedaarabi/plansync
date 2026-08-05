import { describe, expect, it } from "vitest";
import { modelLocalKey } from "./ids";

describe("modelLocalKey", () => {
  it("joins model id and local id", () => {
    expect(modelLocalKey("fileA:fv-1", 42)).toBe("fileA:fv-1:42");
  });

  it("keeps local ids distinct across models", () => {
    expect(modelLocalKey("a", 1)).not.toBe(modelLocalKey("b", 1));
  });
});

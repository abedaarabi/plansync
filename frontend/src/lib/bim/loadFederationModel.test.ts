import { describe, expect, it } from "vitest";
import { CLIENT_IFC_PARSE_MAX_BYTES } from "./loadFetch";

describe("CLIENT_IFC_PARSE_MAX_BYTES", () => {
  it("is below typical large-model crash sizes", () => {
    expect(CLIENT_IFC_PARSE_MAX_BYTES).toBe(150 * 1024 * 1024);
    expect(CLIENT_IFC_PARSE_MAX_BYTES).toBeLessThan(500 * 1024 * 1024);
  });
});

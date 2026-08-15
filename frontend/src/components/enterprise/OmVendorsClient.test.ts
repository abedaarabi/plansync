import { describe, expect, it } from "vitest";
import { vendorFormSchema } from "./OmVendorsClient";

describe("vendorFormSchema", () => {
  it("requires a company name", () => {
    const result = vendorFormSchema.safeParse({ email: "", name: "  ", trade: "" });

    expect(result.success).toBe(false);
  });

  it("allows empty email and rejects invalid email", () => {
    expect(vendorFormSchema.safeParse({ email: "", name: "Acme HVAC", trade: "" }).success).toBe(
      true,
    );
    expect(
      vendorFormSchema.safeParse({ email: "not-an-email", name: "Acme HVAC", trade: "" }).success,
    ).toBe(false);
  });
});

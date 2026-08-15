import { describe, expect, it } from "vitest";
import { formatProjectMoney, normalizeProjectCurrency } from "./projectCurrency";

describe("project currency display", () => {
  it("normalizes accepted currency codes and defaults invalid input to USD", () => {
    expect(normalizeProjectCurrency(" dkk ")).toBe("DKK");
    expect(normalizeProjectCurrency("EUR")).toBe("EUR");
    expect(normalizeProjectCurrency("invalid")).toBe("USD");
    expect(normalizeProjectCurrency(null)).toBe("USD");
  });

  it("formats valid numeric amounts using the selected project currency", () => {
    expect(formatProjectMoney(12.5, "USD")).toBe("$12.50");
    expect(formatProjectMoney("12.5", "DKK")).toContain("DKK");
  });

  it("preserves invalid string values and handles empty amounts", () => {
    expect(formatProjectMoney("not-a-number", "EUR")).toBe("not-a-number");
    expect(formatProjectMoney(null, "EUR")).toBe("—");
  });
});

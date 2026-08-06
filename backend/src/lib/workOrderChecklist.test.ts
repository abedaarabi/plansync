import { describe, expect, it } from "vitest";
import {
  parsePartsUsedJson,
  parseWorkOrderProcedure,
  parseWorkOrderProcedureResults,
  validateProcedureCompletion,
} from "./workOrderChecklist.js";

describe("parseWorkOrderProcedure", () => {
  it("keeps valid steps and drops junk", () => {
    expect(
      parseWorkOrderProcedure([
        { id: "1", label: "Isolate power", type: "checkbox", required: true },
        { id: "", label: "bad" },
        { label: "no id" },
        { id: "2", label: "Voltage check", type: "passfail" },
      ]),
    ).toEqual([
      { id: "1", label: "Isolate power", type: "checkbox", required: true },
      { id: "2", label: "Voltage check", type: "passfail", required: undefined },
    ]);
  });
});

describe("parsePartsUsedJson", () => {
  it("accepts valid parts and rejects bad qty", () => {
    expect(
      parsePartsUsedJson([
        { partName: "Filter", qty: 2, unitCost: 12.5 },
        { partName: "Bad", qty: 0 },
        { partName: "x" },
      ]),
    ).toEqual([{ partName: "Filter", qty: 2, unitCost: 12.5 }]);
  });
});

describe("validateProcedureCompletion", () => {
  const procedure = parseWorkOrderProcedure([
    { id: "a", label: "Lockout", type: "checkbox", required: true },
    { id: "b", label: "Reading", type: "text", required: true },
    { id: "c", label: "Optional", type: "checkbox" },
  ]);

  it("allows empty procedure", () => {
    expect(validateProcedureCompletion([], [])).toBeNull();
  });

  it("blocks incomplete required checkbox", () => {
    expect(
      validateProcedureCompletion(procedure, [
        { itemId: "a", outcome: null },
        { itemId: "b", outcome: "na", note: "ok" },
      ]),
    ).toMatch(/Lockout/);
  });

  it("blocks missing required note", () => {
    expect(
      validateProcedureCompletion(procedure, [
        { itemId: "a", outcome: "done" },
        { itemId: "b", outcome: "na", note: "  " },
      ]),
    ).toMatch(/note missing/i);
  });

  it("passes when required steps are done", () => {
    expect(
      validateProcedureCompletion(procedure, [
        { itemId: "a", outcome: "done" },
        { itemId: "b", outcome: "na", note: "120V" },
      ]),
    ).toBeNull();
  });
});

describe("parseWorkOrderProcedureResults", () => {
  it("parses outcomes", () => {
    expect(
      parseWorkOrderProcedureResults([
        { itemId: "a", outcome: "done", note: " ok " },
        { itemId: "b", outcome: "nope" },
      ]),
    ).toEqual([{ itemId: "a", outcome: "done", note: "ok" }]);
  });
});

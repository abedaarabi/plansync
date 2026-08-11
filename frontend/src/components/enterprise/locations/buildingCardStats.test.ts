import { describe, expect, it } from "vitest";
import { clashesStat, drawingsStat, mappingStat, modelsStat } from "./buildingCardStats";

describe("mappingStat", () => {
  it("is muted with no levels", () => {
    expect(mappingStat(0, 0)).toEqual({ value: "No levels", tone: "muted" });
  });

  it("warns until every level has a drawing", () => {
    expect(mappingStat(3, 0)).toEqual({ value: "0/3 mapped", tone: "warn" });
    expect(mappingStat(3, 2)).toEqual({ value: "2/3 mapped", tone: "warn" });
  });

  it("is ok when fully mapped", () => {
    expect(mappingStat(2, 2)).toEqual({ value: "2/2 mapped", tone: "ok" });
  });
});

describe("drawingsStat", () => {
  it("handles empty, unmapped, and matched PDFs", () => {
    expect(drawingsStat(0, 0)).toEqual({ value: "None", tone: "muted" });
    expect(drawingsStat(4, 2)).toEqual({ value: "2 unmapped", tone: "warn" });
    expect(drawingsStat(3, 0)).toEqual({ value: "3 matched", tone: "ok" });
  });
});

describe("modelsStat", () => {
  it("reports IFC readiness", () => {
    expect(modelsStat(0, 0)).toEqual({ value: "None", tone: "muted" });
    expect(modelsStat(2, 2)).toEqual({ value: "2 ready", tone: "ok" });
    expect(modelsStat(2, 0)).toEqual({ value: "0/2 ready", tone: "warn" });
    expect(modelsStat(2, 1)).toEqual({ value: "1/2 ready", tone: "ok" });
  });
});

describe("clashesStat", () => {
  it("shows open clashes, clear when published, dash in setup", () => {
    expect(clashesStat(3, "ready")).toEqual({ value: "3 open", tone: "warn" });
    expect(clashesStat(0, "ready")).toEqual({ value: "Clear", tone: "ok" });
    expect(clashesStat(0, "needs_update")).toEqual({ value: "Clear", tone: "ok" });
    expect(clashesStat(0, "setup")).toEqual({ value: "—", tone: "muted" });
  });
});

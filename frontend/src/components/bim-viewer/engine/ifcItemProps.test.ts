import { describe, expect, it } from "vitest";
import type * as FRAGS from "@thatopen/fragments";
import { attrValue, extractPsets, flattenAttributes } from "./ifcItemProps";

function attr(value: unknown): FRAGS.ItemAttribute {
  return { value } as FRAGS.ItemAttribute;
}

describe("attrValue", () => {
  it("reads primitive attribute values", () => {
    const item = { Name: attr("Wall-01"), GlobalId: attr("guid-1") } as FRAGS.ItemData;
    expect(attrValue(item, "Name")).toBe("Wall-01");
    expect(attrValue(item, "GlobalId")).toBe("guid-1");
  });

  it("unwraps nested value / wrappedValue objects", () => {
    const item = {
      NominalValue: attr({ value: "2.5" }),
      Other: attr({ wrappedValue: true }),
    } as FRAGS.ItemData;
    expect(attrValue(item, "NominalValue")).toBe("2.5");
    expect(attrValue(item, "Other")).toBe("Yes");
  });

  it("returns null for missing keys, arrays, and empty strings", () => {
    const item = {
      Empty: attr("  "),
      Rel: [{ Name: attr("x") }],
    } as unknown as FRAGS.ItemData;
    expect(attrValue(item, "Missing")).toBeNull();
    expect(attrValue(item, "Empty")).toBeNull();
    expect(attrValue(item, "Rel")).toBeNull();
  });
});

describe("flattenAttributes", () => {
  it("keeps scalar fields and skips relations / object values", () => {
    const item = {
      Name: attr("Door"),
      Tag: attr(12),
      IsDefinedBy: [{ Name: attr("Pset") }],
      Nested: attr({ value: "nested" }),
    } as unknown as FRAGS.ItemData;

    expect(flattenAttributes(item)).toEqual([
      { label: "Name", value: "Door" },
      { label: "Tag", value: "12" },
    ]);
  });
});

describe("extractPsets", () => {
  it("returns empty when IsDefinedBy is missing", () => {
    expect(extractPsets({ Name: attr("x") } as FRAGS.ItemData)).toEqual([]);
  });

  it("extracts HasProperties and quantity sets", () => {
    const item = {
      IsDefinedBy: [
        {
          Name: attr("Pset_WallCommon"),
          HasProperties: [
            { Name: attr("FireRating"), NominalValue: attr("2HR") },
            { Name: attr("IsExternal"), Value: attr(false) },
          ],
        },
        {
          Name: attr("Qto_WallBaseQuantities"),
          Quantities: [
            { Name: attr("Length"), LengthValue: attr(3.2) },
            { Name: attr("Area"), AreaValue: attr(12.5) },
            { Name: attr("Volume"), VolumeValue: attr(1.1) },
          ],
        },
        {
          Name: attr("EmptySet"),
          HasProperties: [],
        },
      ],
    } as unknown as FRAGS.ItemData;

    expect(extractPsets(item)).toEqual([
      {
        name: "Pset_WallCommon",
        props: [
          { label: "FireRating", value: "2HR" },
          { label: "IsExternal", value: "No" },
        ],
      },
      {
        name: "Qto_WallBaseQuantities",
        props: [
          { label: "Length", value: "3.2" },
          { label: "Area", value: "12.5" },
          { label: "Volume", value: "1.1" },
        ],
      },
    ]);
  });

  it("defaults unnamed psets and skips props without labels", () => {
    const item = {
      IsDefinedBy: [
        {
          HasProperties: [
            { NominalValue: attr("orphan") },
            { Name: attr("Keep"), NominalValue: attr("ok") },
          ],
        },
      ],
    } as unknown as FRAGS.ItemData;

    expect(extractPsets(item)).toEqual([
      {
        name: "Property set",
        props: [{ label: "Keep", value: "ok" }],
      },
    ]);
  });
});

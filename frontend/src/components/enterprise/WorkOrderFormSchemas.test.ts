import { describe, expect, it } from "vitest";
import { workOrderCreateSchema } from "./WorkOrderCreateSlideOver";
import { workOrderEditSchema } from "./WorkOrderEditSlideOver";
import { materialsFormSchema } from "./materials/MaterialsFormSlideOver";

describe("work order form schemas", () => {
  it("accepts a non-empty title", () => {
    expect(
      workOrderCreateSchema.safeParse({ description: "", title: "Replace filter" }).success,
    ).toBe(true);
    expect(workOrderEditSchema.safeParse({ title: "Replace filter" }).success).toBe(true);
  });

  it("rejects blank titles", () => {
    expect(workOrderCreateSchema.safeParse({ description: "", title: "   " }).success).toBe(false);
    expect(workOrderEditSchema.safeParse({ title: "   " }).success).toBe(false);
  });
});

describe("materialsFormSchema", () => {
  it("requires a material type and name", () => {
    expect(
      materialsFormSchema.safeParse({ materialType: "Concrete", name: "25 MPa" }).success,
    ).toBe(true);
    expect(materialsFormSchema.safeParse({ materialType: "", name: "25 MPa" }).success).toBe(false);
    expect(materialsFormSchema.safeParse({ materialType: "Concrete", name: " " }).success).toBe(
      false,
    );
  });
});

import type { CSSProperties } from "react";
import { fallbackColorHexForType } from "@/lib/bim/materialColor";
import type { BimQuantityEntry } from "@/lib/bim/types";

export type ElementDisplayColor = {
  hex: string;
  source: "ifc" | "fallback";
  label: string;
};

export function resolveElementDisplayColor(entry: BimQuantityEntry): ElementDisplayColor {
  if (entry.surfaceColor) {
    return { hex: entry.surfaceColor, source: "ifc", label: "IFC surface color" };
  }
  return {
    hex: fallbackColorHexForType(entry.ifcType),
    source: "fallback",
    label: "Discipline fallback",
  };
}

/** Sets `--bim-row-tint` for catalog row hover / selection backgrounds. */
export function elementRowTintVars(hex: string): CSSProperties {
  return { "--bim-row-tint": hex } as CSSProperties;
}

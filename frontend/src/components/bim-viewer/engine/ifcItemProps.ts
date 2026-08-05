import * as FRAGS from "@thatopen/fragments";

// fallow-ignore-next-line complexity
function formatAttrValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") {
    const s = String(value).trim();
    return s === "" ? null : s;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) return formatAttrValue(obj.value);
    if ("wrappedValue" in obj) return formatAttrValue(obj.wrappedValue);
    if ("Name" in obj && typeof obj.Name === "string") return obj.Name;
  }
  return null;
}

export function attrValue(item: FRAGS.ItemData, key: string): string | null {
  const raw = item[key];
  if (!raw || Array.isArray(raw)) return null;
  return formatAttrValue((raw as FRAGS.ItemAttribute).value);
}

function isItemDataArray(
  v: FRAGS.ItemAttribute | FRAGS.ItemData[] | undefined,
): v is FRAGS.ItemData[] {
  return Array.isArray(v);
}

/** Flattens direct (non-relation) attributes of an item into label/value rows. */
// fallow-ignore-next-line complexity
export function flattenAttributes(item: FRAGS.ItemData): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const [key, v] of Object.entries(item)) {
    if (Array.isArray(v)) continue;
    const value = (v as FRAGS.ItemAttribute).value;
    if (value == null || typeof value === "object") continue;
    const s = String(value).trim();
    if (s === "") continue;
    rows.push({ label: key, value: s });
  }
  return rows;
}

/** Extracts IFC property sets from an item's IsDefinedBy relations. */
// fallow-ignore-next-line complexity
export function extractPsets(
  item: FRAGS.ItemData,
): { name: string; props: { label: string; value: string }[] }[] {
  const rel = item.IsDefinedBy;
  if (!isItemDataArray(rel)) return [];
  const out: { name: string; props: { label: string; value: string }[] }[] = [];
  for (const pset of rel) {
    const name = attrValue(pset, "Name") ?? "Property set";
    const props: { label: string; value: string }[] = [];
    const hasProps = pset.HasProperties;
    if (isItemDataArray(hasProps)) {
      for (const p of hasProps) {
        const label = attrValue(p, "Name");
        const value =
          attrValue(p, "NominalValue") ??
          attrValue(p, "Value") ??
          attrValue(p, "EnumerationValues");
        if (label && value != null) props.push({ label, value });
      }
    }
    // Quantity sets (IfcElementQuantity → Quantities)
    const quantities = pset.Quantities;
    if (isItemDataArray(quantities)) {
      for (const q of quantities) {
        const label = attrValue(q, "Name");
        const value =
          attrValue(q, "LengthValue") ??
          attrValue(q, "AreaValue") ??
          attrValue(q, "VolumeValue") ??
          attrValue(q, "CountValue") ??
          attrValue(q, "WeightValue");
        if (label && value != null) props.push({ label, value });
      }
    }
    if (props.length > 0) out.push({ name, props });
  }
  return out;
}

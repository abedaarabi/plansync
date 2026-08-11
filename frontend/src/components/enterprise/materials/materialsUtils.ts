import type { MaterialRow, MaterialTemplateField } from "@/lib/api-client";

export const MATERIALS_CATALOG_HELP =
  'Company-wide catalog: one list for the whole workspace — every project (quantity takeoff, estimates, procurement) draws from the same materials. Types are unique per company (e.g. one "Concrete"); add multiple line items under each type. Use Excel template + import to bulk update. After a super admin changes catalog fields, download a fresh template so columns stay in sync.';

export function formatCustomCell(m: MaterialRow, f: MaterialTemplateField): string {
  const v = m.customAttributes?.[f.key];
  if (v == null || v === "") return "—";
  if (f.type === "currency" || f.type === "number") {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return f.type === "currency"
      ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : String(n);
  }
  const s = String(v);
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

/** Display unit price in the materials table (null/empty → em dash). */
export function formatMaterialMoney(amount: string | null, currencyCode: string): string {
  if (amount == null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  const code = currencyCode.trim().toUpperCase();
  const currency = code.length === 3 ? code : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export type MaterialFormState = {
  materialType: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: string;
  currency: string;
  supplier: string;
  manufacturer: string;
  specification: string;
  notes: string;
  custom: Record<string, string>;
};

export function emptyMaterialForm(customKeys: string[]): MaterialFormState {
  const custom: Record<string, string> = {};
  for (const k of customKeys) custom[k] = "";
  return {
    materialType: "",
    name: "",
    sku: "",
    unit: "ea",
    unitPrice: "",
    currency: "USD",
    supplier: "",
    manufacturer: "",
    specification: "",
    notes: "",
    custom,
  };
}

export function rowToMaterialForm(
  m: MaterialRow,
  fieldKeys: MaterialTemplateField[],
): MaterialFormState {
  const custom: Record<string, string> = {};
  for (const f of fieldKeys) {
    const v = m.customAttributes?.[f.key];
    custom[f.key] = v == null ? "" : String(v);
  }
  return {
    materialType: m.category.name,
    name: m.name,
    sku: m.sku ?? "",
    unit: m.unit,
    unitPrice: m.unitPrice ?? "",
    currency: m.currency,
    supplier: m.supplier ?? "",
    manufacturer: m.manufacturer ?? "",
    specification: m.specification ?? "",
    notes: m.notes ?? "",
    custom,
  };
}

function parseCustomAttribute(type: MaterialTemplateField["type"], raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (type === "number") return Number(trimmed.replace(/,/g, ""));
  if (type === "currency") return trimmed.replace(/,/g, "");
  return trimmed;
}

export function buildMaterialPayload(
  form: MaterialFormState,
  sortedTplFields: MaterialTemplateField[],
) {
  const customAttributes: Record<string, unknown> = {};
  for (const f of sortedTplFields) {
    customAttributes[f.key] = parseCustomAttribute(f.type, form.custom[f.key] ?? "");
  }
  const priceRaw = form.unitPrice.trim();
  return {
    materialType: form.materialType.trim(),
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    unit: form.unit.trim() || "ea",
    unitPrice: priceRaw ? priceRaw.replace(/,/g, "") : null,
    currency: form.currency.trim() || "USD",
    supplier: form.supplier.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    specification: form.specification.trim() || null,
    notes: form.notes.trim() || null,
    customAttributes,
  };
}

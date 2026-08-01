import type { BuildingType } from "@/lib/api-client/locations";

export const BUILDING_TYPE_OPTIONS: { value: BuildingType; label: string }[] = [
  { value: "OFFICE", label: "Office" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "MIXED", label: "Mixed use" },
  { value: "INDUSTRIAL", label: "Industrial" },
  { value: "OTHER", label: "Other" },
];

export function buildingTypeLabel(type: BuildingType | null | undefined): string | null {
  if (!type) return null;
  return BUILDING_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function formatLocationPlace(parts: {
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const line = [parts.address, parts.city, parts.country].filter(Boolean).join(", ");
  return line.length > 0 ? line : null;
}

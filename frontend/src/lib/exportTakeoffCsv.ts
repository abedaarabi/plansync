import type { TakeoffItem, TakeoffPackageStatus, TakeoffZone } from "@/lib/takeoffTypes";
import { sumZonesForItem } from "@/lib/takeoffCompute";

function escCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildTakeoffCsv(
  items: TakeoffItem[],
  zones: TakeoffZone[],
  fileLabel: string,
  opts?: { packageStatus?: TakeoffPackageStatus },
): string {
  const lines: string[] = [];
  lines.push(`# Takeoff summary — ${fileLabel}`);
  if (opts?.packageStatus) {
    lines.push(`# Package status: ${opts.packageStatus}`);
  }
  lines.push(
    ["Item", "Unit", "Qty", "Rate", "Extended", "Zones", "Category", "MaterialId", "Notes"]
      .map(escCell)
      .join(","),
  );

  for (const item of items) {
    const zs = zones.filter((z) => z.itemId === item.id);
    const qty = sumZonesForItem(zones, item.id);
    const rate = item.rate;
    const ext = rate != null && Number.isFinite(rate) && Number.isFinite(qty) ? qty * rate : "";
    lines.push(
      [
        item.name,
        item.unit,
        String(Math.round(qty * 1000) / 1000),
        rate != null && Number.isFinite(rate) ? String(rate) : "",
        ext !== "" ? String(Math.round(Number(ext) * 100) / 100) : "",
        String(zs.length),
        item.category ?? "",
        item.materialId ?? "",
        (item.notes ?? "").replace(/\n/g, " "),
      ]
        .map(escCell)
        .join(","),
    );
  }

  lines.push("");
  lines.push(["ZoneId", "Item", "Page", "Type", "Qty", "Notes"].map(escCell).join(","));
  for (const z of zones) {
    const item = items.find((i) => i.id === z.itemId);
    lines.push(
      [
        z.id,
        item?.name ?? z.itemId,
        String(z.pageIndex + 1),
        z.measurementType,
        String(Math.round(z.computedQuantity * 1000) / 1000),
        (z.notes ?? "").replace(/\n/g, " "),
      ]
        .map(escCell)
        .join(","),
    );
  }

  return lines.join("\r\n");
}

export function downloadTakeoffCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

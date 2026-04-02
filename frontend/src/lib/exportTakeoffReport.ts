import type { TakeoffItem, TakeoffPackageStatus, TakeoffZone } from "@/lib/takeoffTypes";
import { sumZonesForItem } from "@/lib/takeoffCompute";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Opens a print dialog; user can choose “Save as PDF” as destination. */
export function openTakeoffPrintReport(
  items: TakeoffItem[],
  zones: TakeoffZone[],
  fileLabel: string,
  opts?: { packageStatus?: TakeoffPackageStatus },
): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;

  const rows = items.map((item) => {
    const zs = zones.filter((z) => z.itemId === item.id);
    const qty = sumZonesForItem(zones, item.id);
    const pages = [...new Set(zs.map((z) => z.pageIndex + 1))].sort((a, b) => a - b);
    const pageStr =
      pages.length === 0
        ? "—"
        : pages.length === 1
          ? `p.${pages[0]}`
          : `p.${pages[0]}–${pages[pages.length - 1]}`;
    const typeLabel =
      item.measurementType === "area"
        ? "Area"
        : item.measurementType === "linear"
          ? "Linear"
          : "Count";
    return `<tr>
      <td>${escHtml(item.name)}</td>
      <td>${zs.length}</td>
      <td>${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
      <td>${escHtml(item.unit)}</td>
      <td>${escHtml(pageStr)}</td>
      <td>${typeLabel}</td>
    </tr>`;
  });

  const zoneRows = zones
    .map((z) => {
      const item = items.find((i) => i.id === z.itemId);
      return `<tr>
        <td>${escHtml(item?.name ?? z.itemId)}</td>
        <td>${z.pageIndex + 1}</td>
        <td>${z.measurementType}</td>
        <td>${z.computedQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
      </tr>`;
    })
    .join("");

  w.document
    .write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escHtml(fileLabel)} — Takeoff</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #444; font-size: 13px; margin: 0 0 20px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 28px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  h2 { font-size: 14px; margin: 24px 0 8px; }
</style></head><body>
<h1>Quantity takeoff</h1>
<p>${escHtml(fileLabel)}${
    opts?.packageStatus ? ` · Status: <strong>${escHtml(opts.packageStatus)}</strong>` : ""
  }</p>
<table>
  <thead><tr><th>Name</th><th>Zones</th><th>Quantity</th><th>Unit</th><th>Page</th><th>Type</th></tr></thead>
  <tbody>${rows.join("")}</tbody>
</table>
<h2>Zones</h2>
<table>
  <thead><tr><th>Item</th><th>Page</th><th>Type</th><th>Qty</th></tr></thead>
  <tbody>${zoneRows}</tbody>
</table>
</body></html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 150);
}

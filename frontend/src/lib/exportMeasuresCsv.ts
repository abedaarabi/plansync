import { formatAreaMm2, formatLengthMm, type MeasureUnit } from "@/lib/coords";
import type { Annotation } from "@/store/viewerStore";

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * CSV of all measurement annotations (optionally filtered by page).
 */
export function buildMeasuresCsv(
  annotations: Annotation[],
  measureUnit: MeasureUnit,
  pageFilter0: number | null,
): string {
  const rows: string[][] = [["Page", "Kind", "Value", "Notes"]];
  const list = annotations.filter((a) => {
    if (a.type !== "measurement") return false;
    if (pageFilter0 !== null && a.pageIndex !== pageFilter0) return false;
    return true;
  });
  for (const a of list) {
    const mk = a.measurementKind ?? "line";
    const page = String(a.pageIndex + 1);
    let value = "";
    if (mk === "line" && a.lengthMm != null) {
      value = formatLengthMm(a.lengthMm, measureUnit);
    } else if (mk === "area" && a.areaMm2 != null) {
      value = formatAreaMm2(a.areaMm2, measureUnit);
    } else if (mk === "perimeter" && a.lengthMm != null) {
      value = formatLengthMm(a.lengthMm, measureUnit);
    } else if (mk === "angle" && a.angleDeg != null) {
      value = `${a.angleDeg.toFixed(1)}°`;
    } else {
      value = "—";
    }
    rows.push([page, mk, value, a.author ?? ""]);
  }
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
}

export function downloadMeasuresCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

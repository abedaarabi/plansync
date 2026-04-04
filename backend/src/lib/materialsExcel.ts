import * as XLSX from "xlsx";
import { parseMaterialTemplateJson } from "./materialTemplate.js";

export const MATERIAL_TEMPLATE_HEADERS = [
  "Material Type",
  "Material Name",
  "SKU",
  "Unit",
  "Unit Price",
  "Currency",
  "Supplier",
  "Manufacturer",
  "Specification",
  "Notes",
] as const;

export type MaterialsImportRow = {
  materialType: string;
  materialName: string;
  sku: string;
  unit: string;
  unitPrice: string;
  currency: string;
  supplier: string;
  manufacturer: string;
  specification: string;
  notes: string;
  /** Raw cell strings keyed by MaterialTemplateField.key */
  customValues: Record<string, string>;
};

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function normHeaderLabel(s: string): string {
  return cellStr(s).toLowerCase().replace(/\s+/g, " ");
}

export function buildMaterialsTemplateBuffer(templateRaw: unknown): Buffer {
  const template = parseMaterialTemplateJson(templateRaw);
  const sorted = [...template.fields].sort((a, b) => a.order - b.order);
  const headers = [...MATERIAL_TEMPLATE_HEADERS, ...sorted.map((f) => f.label)];
  const exampleCore = [
    "Concrete",
    "Ready-mix 25 MPa",
    "RM-25-001",
    "m³",
    "185.00",
    "USD",
    "ABC Ready Mix Co.",
    "",
    "ASTM C94",
    "Include air entrainment",
  ];
  const exampleCustom = sorted.map((f) => {
    if (f.type === "number") return "12.5";
    if (f.type === "currency") return "0.00";
    return "—";
  });
  const exampleRow = [...exampleCore, ...exampleCustom];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const colWidths = [
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
    { wch: 30 },
    ...sorted.map(() => ({ wch: 16 })),
  ];
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Materials");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/** Parse uploaded workbook; first sheet, first row = headers. */
export function parseMaterialsImportBuffer(
  buf: Buffer,
  templateRaw: unknown,
): {
  rows: MaterialsImportRow[];
  errors: string[];
} {
  const template = parseMaterialTemplateJson(templateRaw);
  const errors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return { rows: [], errors: ["Could not read Excel file. Use .xlsx format."] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["Workbook has no sheets."] };
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (aoa.length < 2) {
    return { rows: [], errors: ["Add at least one data row below the header row."] };
  }

  const headerCells = (aoa[0] as unknown[]).map((c) => cellStr(c));
  const header = headerCells.map((h) => normHeaderLabel(h));
  const findCol = (aliases: string[]) => {
    const normAliases = aliases.map((a) => a.toLowerCase().replace(/\s+/g, " "));
    for (let i = 0; i < header.length; i++) {
      const h = header[i];
      if (normAliases.includes(h)) return i;
    }
    return -1;
  };

  const iType = findCol(["material type", "type", "category"]);
  const iName = findCol(["material name", "name", "description"]);
  if (iType < 0 || iName < 0) {
    errors.push(
      "Missing required columns. The first row must include headers like Material Type and Material Name.",
    );
    return { rows: [], errors };
  }

  const iSku = findCol(["sku", "code", "product code"]);
  const iUnit = findCol(["unit", "uom"]);
  const iPrice = findCol(["unit price", "price", "cost"]);
  const iCur = findCol(["currency", "curr"]);
  const iSup = findCol(["supplier", "vendor"]);
  const iMfg = findCol(["manufacturer", "mfg"]);
  const iSpec = findCol(["specification", "spec", "grade"]);
  const iNotes = findCol(["notes", "comments"]);

  const usedIndices = new Set<number>(
    [iType, iName, iSku, iUnit, iPrice, iCur, iSup, iMfg, iSpec, iNotes].filter((i) => i >= 0),
  );

  const sortedFields = [...template.fields].sort((a, b) => a.order - b.order);
  const customColByKey: Record<string, number> = {};
  for (const f of sortedFields) {
    const aliases = [
      normHeaderLabel(f.label),
      f.key.toLowerCase(),
      normHeaderLabel(f.key.replace(/_/g, " ")),
    ];
    const idx = findCol(aliases);
    if (idx >= 0) {
      customColByKey[f.key] = idx;
      usedIndices.add(idx);
    }
  }

  let unknownWarn = 0;
  const MAX_UNKNOWN = 15;
  for (let i = 0; i < header.length; i++) {
    if (usedIndices.has(i)) continue;
    const raw = headerCells[i]?.trim();
    if (!raw) continue;
    if (unknownWarn < MAX_UNKNOWN) {
      errors.push(`Ignoring unrecognized column: ${raw}`);
      unknownWarn++;
    }
  }

  const rows: MaterialsImportRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] as unknown[];
    if (!row || row.every((c) => cellStr(c) === "")) continue;
    const materialType = iType >= 0 ? cellStr(row[iType]) : "";
    const materialName = iName >= 0 ? cellStr(row[iName]) : "";
    if (!materialType && !materialName) continue;
    if (!materialType || !materialName) {
      errors.push(`Row ${r + 1}: Material Type and Material Name are required.`);
      continue;
    }
    const customValues: Record<string, string> = {};
    for (const f of sortedFields) {
      const col = customColByKey[f.key];
      if (col !== undefined && col >= 0) {
        customValues[f.key] = cellStr(row[col]);
      }
    }
    rows.push({
      materialType,
      materialName,
      sku: iSku >= 0 ? cellStr(row[iSku]) : "",
      unit: iUnit >= 0 ? cellStr(row[iUnit]) : "ea",
      unitPrice: iPrice >= 0 ? cellStr(row[iPrice]) : "",
      currency: iCur >= 0 ? cellStr(row[iCur]) : "USD",
      supplier: iSup >= 0 ? cellStr(row[iSup]) : "",
      manufacturer: iMfg >= 0 ? cellStr(row[iMfg]) : "",
      specification: iSpec >= 0 ? cellStr(row[iSpec]) : "",
      notes: iNotes >= 0 ? cellStr(row[iNotes]) : "",
      customValues,
    });
  }

  return { rows, errors };
}

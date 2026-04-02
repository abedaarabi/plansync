import * as XLSX from "xlsx";
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
];
export function buildMaterialsTemplateBuffer() {
    const wb = XLSX.utils.book_new();
    const exampleRow = [
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
    const ws = XLSX.utils.aoa_to_sheet([
        MATERIAL_TEMPLATE_HEADERS,
        exampleRow,
    ]);
    ws["!cols"] = [
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
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
function cellStr(v) {
    if (v === undefined || v === null)
        return "";
    if (typeof v === "number")
        return String(v);
    return String(v).trim();
}
/** Parse uploaded workbook; first sheet, first row = headers. */
export function parseMaterialsImportBuffer(buf) {
    const errors = [];
    let wb;
    try {
        wb = XLSX.read(buf, { type: "buffer" });
    }
    catch {
        return { rows: [], errors: ["Could not read Excel file. Use .xlsx format."] };
    }
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        return { rows: [], errors: ["Workbook has no sheets."] };
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (aoa.length < 2) {
        return { rows: [], errors: ["Add at least one data row below the header row."] };
    }
    const header = aoa[0].map((c) => cellStr(c).toLowerCase().replace(/\s+/g, " "));
    const findCol = (aliases) => {
        const normAliases = aliases.map((a) => a.toLowerCase().replace(/\s+/g, " "));
        for (let i = 0; i < header.length; i++) {
            const h = header[i];
            if (normAliases.includes(h))
                return i;
        }
        return -1;
    };
    const iType = findCol(["material type", "type", "category"]);
    const iName = findCol(["material name", "name", "description"]);
    if (iType < 0 || iName < 0) {
        errors.push("Missing required columns. The first row must include headers like Material Type and Material Name.");
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
    const rows = [];
    for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every((c) => cellStr(c) === ""))
            continue;
        const materialType = iType >= 0 ? cellStr(row[iType]) : "";
        const materialName = iName >= 0 ? cellStr(row[iName]) : "";
        if (!materialType && !materialName)
            continue;
        if (!materialType || !materialName) {
            errors.push(`Row ${r + 1}: Material Type and Material Name are required.`);
            continue;
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
        });
    }
    return { rows, errors };
}

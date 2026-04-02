/** PDF user space units per page (viewport scale 1) are typographic points (1/72 in). */
const MM_PER_PDF_UNIT = 25.4 / 72;

export function pdfUnitsToMm(n: number): number {
  return n * MM_PER_PDF_UNIT;
}

const SHEETS: { name: string; shortMm: number; longMm: number }[] = [
  { name: "A0", shortMm: 841, longMm: 1189 },
  { name: "A1", shortMm: 594, longMm: 841 },
  { name: "A2", shortMm: 420, longMm: 594 },
  { name: "A3", shortMm: 297, longMm: 420 },
  { name: "A4", shortMm: 210, longMm: 297 },
  { name: "A5", shortMm: 148, longMm: 210 },
  { name: "Letter", shortMm: 215.9, longMm: 279.4 },
  { name: "Legal", shortMm: 215.9, longMm: 355.6 },
  { name: "Tabloid", shortMm: 279.4, longMm: 431.8 },
];

/** If dimensions match a common sheet within tolerance, return its name. */
export function guessPaperName(wMm: number, hMm: number, tolMm = 3): string | null {
  const s = Math.min(wMm, hMm);
  const l = Math.max(wMm, hMm);
  for (const p of SHEETS) {
    if (Math.abs(s - p.shortMm) <= tolMm && Math.abs(l - p.longMm) <= tolMm) return p.name;
  }
  return null;
}

/** Short label for toolbar (full detail in title). */
export function formatPageSizeShort(wPt: number, hPt: number): string {
  const wMm = pdfUnitsToMm(wPt);
  const hMm = pdfUnitsToMm(hPt);
  const guess = guessPaperName(wMm, hMm);
  const mm = `${Math.round(wMm)}×${Math.round(hMm)} mm`;
  return guess ? `${guess} · ${mm}` : mm;
}

export function formatPageSizeTitle(wPt: number, hPt: number): string {
  const wMm = pdfUnitsToMm(wPt);
  const hMm = pdfUnitsToMm(hPt);
  const wIn = wPt / 72;
  const hIn = hPt / 72;
  const guess = guessPaperName(wMm, hMm);
  const line1 = `${wMm.toFixed(1)} × ${hMm.toFixed(1)} mm (${wIn.toFixed(2)} × ${hIn.toFixed(2)} in)`;
  const line2 = `${wPt.toFixed(1)} × ${hPt.toFixed(1)} pt (PDF units)`;
  return guess ? `${guess}\n${line1}\n${line2}` : `${line1}\n${line2}`;
}

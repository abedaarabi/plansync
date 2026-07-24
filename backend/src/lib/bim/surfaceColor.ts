/** Extract IFC surface / style RGB as #rrggbb from web-ifc material property trees. */

function numVal(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.value === "number" && Number.isFinite(o.value)) return o.value;
  if (typeof o.Value === "number" && Number.isFinite(o.Value)) return o.Value;
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const scale = max <= 1 ? 255 : 1;
  const byte = (n: number) => Math.min(255, Math.max(0, Math.round(n * scale)));
  const rr = byte(r).toString(16).padStart(2, "0");
  const gg = byte(g).toString(16).padStart(2, "0");
  const bb = byte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function isDefaultGrayRgb(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const scale = max <= 1 ? 255 : 1;
  const R = r * scale;
  const G = g * scale;
  const B = b * scale;
  const grays: [number, number, number][] = [
    [128, 128, 128],
    [191, 191, 191],
    [204, 204, 204],
    [127, 127, 127],
    [179, 179, 179],
  ];
  for (const [dr, dg, db] of grays) {
    if (Math.abs(R - dr) < 10 && Math.abs(G - dg) < 10 && Math.abs(B - db) < 10) return true;
  }
  const avg = (R + G + B) / 3;
  const spread = Math.max(Math.abs(R - avg), Math.abs(G - avg), Math.abs(B - avg));
  return spread < 8;
}

// fallow-ignore-next-line complexity
function colorFromRecord(rec: Record<string, unknown>): string | null {
  const r = numVal(rec.Red ?? rec.red ?? rec.R);
  const g = numVal(rec.Green ?? rec.green ?? rec.G);
  const b = numVal(rec.Blue ?? rec.blue ?? rec.B);
  if (r == null || g == null || b == null) return null;
  if (isDefaultGrayRgb(r, g, b)) return null;
  return rgbToHex(r, g, b);
}

// fallow-ignore-next-line complexity
function walkForColor(value: unknown, depth = 0): string | null {
  if (value == null || depth > 8) return null;

  if (Array.isArray(value)) {
    if (value.length >= 3 && typeof value[0] === "number" && typeof value[1] === "number") {
      const hex = colorFromRecord({ Red: value[0], Green: value[1], Blue: value[2] });
      if (hex) return hex;
    }
    for (const item of value) {
      const hex = walkForColor(item, depth + 1);
      if (hex) return hex;
    }
    return null;
  }

  if (typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;

  const direct = colorFromRecord(rec);
  if (direct) return direct;

  for (const key of [
    "SurfaceColour",
    "SurfaceColor",
    "Rendering",
    "HasRendering",
    "HasStyles",
    "Styles",
    "HasColours",
    "Colours",
    "Colors",
    "Styles",
  ]) {
    if (key in rec) {
      const hex = walkForColor(rec[key], depth + 1);
      if (hex) return hex;
    }
  }

  for (const nested of Object.values(rec)) {
    if (nested && typeof nested === "object") {
      const hex = walkForColor(nested, depth + 1);
      if (hex) return hex;
    }
  }

  return null;
}

export function extractSurfaceColorFromMaterials(materials: unknown[]): string | null {
  for (const m of materials) {
    const hex = walkForColor(m);
    if (hex) return hex;
  }
  return null;
}

export function hasAuthoredSurfaceStyle(
  materials: unknown[],
  surfaceColor: string | null,
): boolean {
  return Boolean(surfaceColor);
}

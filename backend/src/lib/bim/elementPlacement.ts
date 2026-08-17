import { ifcNumVal } from "./ifcParseUtils.js";

export type ElementPlacement = { x: number; y: number; z: number };

type LineReader = {
  GetLine: (modelId: number, expressId: number) => unknown;
};

function handleId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (!value || typeof value !== "object") return null;
  const rec = value as { value?: unknown; expressID?: unknown };
  const n = rec.value ?? rec.expressID;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  return null;
}

function cartesian(pt: unknown): ElementPlacement | null {
  if (!pt || typeof pt !== "object") return null;
  const coords = (pt as { Coordinates?: unknown }).Coordinates;
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const x = ifcNumVal(coords[0]);
  const y = ifcNumVal(coords[1]);
  const z = ifcNumVal(coords[2]);
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function add(a: ElementPlacement, b: ElementPlacement): ElementPlacement {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Round to ~1mm whether the IFC is in metres or millimetres. */
export function roundPlacement(p: ElementPlacement): ElementPlacement {
  const step = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) > 100 ? 1 : 0.001;
  const round = (n: number) => Math.round(n / step) * step;
  return { x: round(p.x), y: round(p.y), z: round(p.z) };
}

/** True when both sides have a placement and they differ after rounding. */
export function placementsDiffer(
  a: ElementPlacement | null | undefined,
  b: ElementPlacement | null | undefined,
): boolean {
  if (!a || !b) return false;
  const left = roundPlacement(a);
  const right = roundPlacement(b);
  return left.x !== right.x || left.y !== right.y || left.z !== right.z;
}

export function formatPlacement(p: ElementPlacement | null | undefined): string | null {
  if (!p) return null;
  const r = roundPlacement(p);
  return `${r.x}, ${r.y}, ${r.z}`;
}

function walkPlacement(
  ifcApi: LineReader,
  modelId: number,
  placementId: number,
  depth: number,
): ElementPlacement | null {
  if (depth > 16) return null;
  const line = ifcApi.GetLine(modelId, placementId) as {
    PlacementRelTo?: unknown;
    RelativePlacement?: unknown;
    Location?: unknown;
  };
  const relativeId = handleId(line.RelativePlacement);
  let local: ElementPlacement | null = null;
  if (relativeId != null) {
    const axis = ifcApi.GetLine(modelId, relativeId) as { Location?: unknown };
    const locId = handleId(axis?.Location);
    local = locId != null ? cartesian(ifcApi.GetLine(modelId, locId)) : cartesian(axis);
  } else {
    local = cartesian(line);
  }
  const parentId = handleId(line.PlacementRelTo);
  if (parentId == null) return local;
  const parent = walkPlacement(ifcApi, modelId, parentId, depth + 1);
  if (!parent) return local;
  if (!local) return parent;
  return add(parent, local);
}

/** Approximate world origin from IfcLocalPlacement (translation only). */
export function readElementPlacement(
  ifcApi: LineReader,
  modelId: number,
  expressId: number,
): ElementPlacement | null {
  try {
    const line = ifcApi.GetLine(modelId, expressId) as { ObjectPlacement?: unknown };
    const placementId = handleId(line?.ObjectPlacement);
    if (placementId == null) return null;
    const raw = walkPlacement(ifcApi, modelId, placementId, 0);
    return raw ? roundPlacement(raw) : null;
  } catch {
    return null;
  }
}

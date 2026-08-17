import { createHash } from "node:crypto";
import type { BimQuantityEntry } from "./types.js";

const FLOAT_PRECISION = 6;

/** Keys excluded from metadata hash (volatile export noise). */
const HASH_EXCLUDE_KEYS = new Set([
  "generatedAt",
  "fileVersionId",
  "sourceFileVersionId",
  "sourceModelId",
  "sourceLabel",
  // Compared separately so a reconvert does not mark every element modified.
  "placement",
  "expressId",
]);

function roundFloat(n: number): number {
  const f = 10 ** FLOAT_PRECISION;
  return Math.round(n * f) / f;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return roundFloat(value);
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") return sortKeys(value as Record<string, unknown>);
  return value;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (HASH_EXCLUDE_KEYS.has(key)) continue;
    out[key] = normalizeValue(obj[key]);
  }
  return out;
}

/** Canonical metadata payload for hashing (stable across re-exports). */
export function canonicalElementMetadata(entry: BimQuantityEntry): Record<string, unknown> {
  return sortKeys({
    guid: entry.guid,
    ifcType: entry.ifcType,
    name: entry.name,
    typeName: entry.typeName ?? null,
    level: entry.level,
    material: entry.material,
    discipline: entry.discipline,
    surfaceColor: entry.surfaceColor ?? null,
    quantities: entry.quantities,
    quantitySource: entry.quantitySource,
    lodFlags: entry.lodFlags,
  });
}

export function hashElementMetadata(entry: BimQuantityEntry): string {
  const canonical = JSON.stringify(canonicalElementMetadata(entry));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function hashBufferSha256(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function webIfcWasmDir(): string {
  const candidates = [
    join(__dirname, "../../../../node_modules/web-ifc"),
    join(__dirname, "../../../node_modules/web-ifc"),
    join(process.cwd(), "node_modules/web-ifc"),
    join(process.cwd(), "../node_modules/web-ifc"),
  ];
  for (const p of candidates) {
    if (existsSync(join(p, "web-ifc-node.wasm")) || existsSync(join(p, "web-ifc.wasm"))) {
      return p.endsWith("/") ? p : `${p}/`;
    }
  }
  const fallback = candidates[0]!;
  return fallback.endsWith("/") ? fallback : `${fallback}/`;
}

export function ifcStrVal(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? null : s;
  }
  if (typeof v === "object" && v !== null && "value" in v) {
    return ifcStrVal((v as { value: unknown }).value);
  }
  return String(v);
}

export function ifcNumVal(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v !== null && "value" in v) {
    const n = Number((v as { value: unknown }).value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

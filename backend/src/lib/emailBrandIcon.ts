import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _dir = dirname(fileURLToPath(import.meta.url));

/** Relative to compiled `dist/lib` or source `src/lib` → `backend/assets/`. */
function emailIconCandidatePaths(): string[] {
  return [
    join(_dir, "../../assets/plansync-email-icon-192.png"),
    join(process.cwd(), "backend/assets/plansync-email-icon-192.png"),
    join(process.cwd(), "assets/plansync-email-icon-192.png"),
  ];
}

let cached: Buffer | null | undefined;

/** PNG bytes for transactional email `<img>` (192×192). Null only if no candidate path exists. */
export function getEmailBrandIconPngBytes(): Buffer | null {
  if (cached !== undefined) return cached;
  for (const p of emailIconCandidatePaths()) {
    try {
      const buf = readFileSync(p);
      if (buf.length > 0) {
        cached = buf;
        return cached;
      }
    } catch {
      /* try next */
    }
  }
  cached = null;
  return null;
}

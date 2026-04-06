import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _dir = dirname(fileURLToPath(import.meta.url));
const EMAIL_ICON_PATH = join(_dir, "../../assets/plansync-email-icon-192.png");

let cached: Buffer | null | undefined;

/** PNG bytes for transactional email `<img>` (192×192). Null if asset missing on disk. */
export function getEmailBrandIconPngBytes(): Buffer | null {
  if (cached !== undefined) return cached;
  try {
    cached = readFileSync(EMAIL_ICON_PATH);
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

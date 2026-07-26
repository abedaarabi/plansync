/**
 * IndexedDB cache for converted BIM Fragments buffers, keyed by file version.
 * Raw IFC → Fragments conversion is expensive (WASM, tens of seconds for large
 * models), so each browser converts once and re-opens instantly afterwards.
 * Per-browser only in M1 — nothing is shared across devices or users.
 */

import { BIM_RENDER_PROFILE_VERSION } from "@/lib/bim/renderingProfile";
import { readAndTouchIndexedDbRow, writeIndexedDbRow } from "@/lib/indexedDbHelpers";

const DB_NAME = "plansync-bim-fragments";
const STORE = "fragments";
const DB_VERSION = 1;
/** Evict least-recently-used entries beyond this budget (~600MB of .frag). */
const MAX_TOTAL_BYTES = 600 * 1024 * 1024;

type CacheRow = {
  key: string;
  buffer: ArrayBuffer;
  sizeBytes: number;
  lastAccess: number;
};

export function buildFragmentsCacheKey(fileId: string, fileVersionId: string | null): string {
  return `frag:v${BIM_RENDER_PROFILE_VERSION}:${fileId}:${fileVersionId ?? "latest"}`;
}

export async function readCachedFragments(key: string): Promise<ArrayBuffer | null> {
  try {
    const row = await readAndTouchIndexedDbRow<CacheRow>(DB_NAME, STORE, key, DB_VERSION);
    return row?.buffer ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedFragments(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    await writeIndexedDbRow(
      DB_NAME,
      STORE,
      {
        key,
        buffer,
        sizeBytes: buffer.byteLength,
        lastAccess: Date.now(),
      },
      MAX_TOTAL_BYTES,
      DB_VERSION,
    );
  } catch {
    /* Cache is best-effort — conversion still succeeded in-memory. */
  }
}

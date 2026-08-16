/**
 * IndexedDB cache for BIM quantity indices, keyed by file version.
 * Summary indices are small; full indices can be large but avoid repeat downloads.
 */

import type { BimQuantityIndex } from "@/lib/bim/types";
import {
  deleteIndexedDbRow,
  readAndTouchIndexedDbRow,
  writeIndexedDbRow,
} from "@/lib/indexedDbHelpers";

const DB_NAME = "plansync-bim-quantity-index";
const STORE = "indices";
const DB_VERSION = 1;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

type CacheRow = {
  key: string;
  indexJson: string;
  partial: boolean;
  generatedAt: string;
  sizeBytes: number;
  lastAccess: number;
};

export function buildQuantityIndexCacheKey(fileVersionId: string): string {
  // v3: invalidate empty typeName indexes built by the stale dist conversion worker.
  return `qty:v3:${fileVersionId}`;
}

export async function readCachedQuantityIndex(
  key: string,
): Promise<{ index: BimQuantityIndex; partial: boolean } | null> {
  try {
    const row = await readAndTouchIndexedDbRow<CacheRow>(DB_NAME, STORE, key, DB_VERSION);
    if (!row) return null;
    return { index: JSON.parse(row.indexJson) as BimQuantityIndex, partial: row.partial };
  } catch {
    return null;
  }
}

export async function removeCachedQuantityIndex(key: string): Promise<void> {
  try {
    await deleteIndexedDbRow(DB_NAME, STORE, key, DB_VERSION);
  } catch {
    /* best-effort */
  }
}

export async function writeCachedQuantityIndex(
  key: string,
  index: BimQuantityIndex,
): Promise<void> {
  try {
    const indexJson = JSON.stringify(index);
    await writeIndexedDbRow(
      DB_NAME,
      STORE,
      {
        key,
        indexJson,
        partial: Boolean(index.partial),
        generatedAt: index.generatedAt,
        sizeBytes: indexJson.length,
        lastAccess: Date.now(),
      },
      MAX_TOTAL_BYTES,
      DB_VERSION,
    );
  } catch {
    /* best-effort */
  }
}

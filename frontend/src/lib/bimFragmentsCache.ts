/**
 * IndexedDB cache for converted BIM Fragments buffers, keyed by file version.
 * Raw IFC → Fragments conversion is expensive (WASM, tens of seconds for large
 * models), so each browser converts once and re-opens instantly afterwards.
 * Per-browser only in M1 — nothing is shared across devices or users.
 */

import { BIM_RENDER_PROFILE_VERSION } from "@/lib/bim/renderingProfile";

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

// fallow-ignore-next-line complexity
export async function readCachedFragments(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const row = await new Promise<CacheRow | undefined>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as CacheRow | undefined);
      req.onerror = () => reject(req.error);
    });
    if (row) {
      store.put({ ...row, lastAccess: Date.now() } satisfies CacheRow);
    }
    await txDone(tx);
    db.close();
    return row?.buffer ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedFragments(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({
      key,
      buffer,
      sizeBytes: buffer.byteLength,
      lastAccess: Date.now(),
    } satisfies CacheRow);
    await txDone(tx);

    await evictIfOverBudget(db, buffer.byteLength);
    db.close();
  } catch {
    /* Cache is best-effort — conversion still succeeded in-memory. */
  }
}

async function evictIfOverBudget(db: IDBDatabase, _justAdded: number): Promise<void> {
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rows = await new Promise<CacheRow[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as CacheRow[]);
    req.onerror = () => reject(req.error);
  });
  let total = rows.reduce((s, r) => s + r.sizeBytes, 0);
  if (total <= MAX_TOTAL_BYTES) {
    await txDone(tx);
    return;
  }
  const byOldest = [...rows].sort((a, b) => a.lastAccess - b.lastAccess);
  for (const row of byOldest) {
    if (total <= MAX_TOTAL_BYTES) break;
    store.delete(row.key);
    total -= row.sizeBytes;
  }
  await txDone(tx);
}

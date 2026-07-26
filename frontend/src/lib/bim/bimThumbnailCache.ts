import { openIndexedDb, txDone } from "@/lib/indexedDbHelpers";

const DB_NAME = "plansync-bim-thumbnails";
const STORE = "thumbnails";
const DB_VERSION = 1;

type ThumbRow = {
  key: string;
  dataUrl: string;
  updatedAt: number;
};

export function buildThumbnailCacheKey(fileVersionId: string): string {
  return `thumb:v1:${fileVersionId}`;
}

export async function readCachedThumbnail(key: string): Promise<string | null> {
  try {
    const db = await openIndexedDb(DB_NAME, STORE, DB_VERSION);
    const tx = db.transaction(STORE, "readonly");
    const row = await new Promise<ThumbRow | undefined>((resolve, reject) => {
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as ThumbRow | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row?.dataUrl ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedThumbnail(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openIndexedDb(DB_NAME, STORE, DB_VERSION);
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key,
      dataUrl,
      updatedAt: Date.now(),
    } satisfies ThumbRow);
    await txDone(tx);
    db.close();
  } catch {
    /* best-effort */
  }
}

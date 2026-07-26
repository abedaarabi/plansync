export function openIndexedDb(
  dbName: string,
  storeName: string,
  version = 1,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) {
        req.result.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function readAndTouchIndexedDbRow<T extends { key: string; lastAccess: number }>(
  dbName: string,
  storeName: string,
  key: string,
  version = 1,
): Promise<T | undefined> {
  const db = await openIndexedDb(dbName, storeName, version);
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const row = await new Promise<T | undefined>((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  if (row) {
    store.put({ ...row, lastAccess: Date.now() });
  }
  await txDone(tx);
  db.close();
  return row;
}

export async function writeIndexedDbRow<
  T extends { key: string; lastAccess: number; sizeBytes: number },
>(dbName: string, storeName: string, row: T, maxTotalBytes: number, version = 1): Promise<void> {
  const db = await openIndexedDb(dbName, storeName, version);
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(row);
  await txDone(tx);
  await evictIndexedDbLru(db, storeName, maxTotalBytes, (r) => r.sizeBytes);
  db.close();
}

async function evictIndexedDbLru(
  db: IDBDatabase,
  storeName: string,
  maxTotalBytes: number,
  sizeOf: (row: { sizeBytes: number }) => number,
): Promise<void> {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const rows = await new Promise<Array<{ key: string; sizeBytes: number; lastAccess: number }>>(
    (resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () =>
        resolve(req.result as Array<{ key: string; sizeBytes: number; lastAccess: number }>);
      req.onerror = () => reject(req.error);
    },
  );
  let total = rows.reduce((s, r) => s + sizeOf(r), 0);
  if (total <= maxTotalBytes) {
    await txDone(tx);
    return;
  }
  const byOldest = [...rows].sort((a, b) => a.lastAccess - b.lastAccess);
  for (const row of byOldest) {
    if (total <= maxTotalBytes) break;
    store.delete(row.key);
    total -= sizeOf(row);
  }
  await txDone(tx);
}

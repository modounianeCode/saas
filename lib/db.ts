const DB_NAME = "argent-clair";
const DB_VERSION = 1;
const KV_STORE = "kv";
const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, "readonly");
      const req = tx.objectStore(KV_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, "readwrite");
      tx.objectStore(KV_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache indisponible (navigation privée, etc.) : on continue en réseau.
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KV_STORE, "readwrite");
      tx.objectStore(KV_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache indisponible : rien à purger.
  }
}

export type OutboxOp = {
  id?: number;
  type: string;
  payload: Record<string, unknown>;
  /** Propriétaire de l'opération. Les opérations mises en file avant cette
   *  version n'en ont pas : elles sont alors considérées comme appartenant
   *  à l'utilisateur connecté (compatibilité). */
  userId?: string;
  createdAt: number;
};

export async function outboxAdd(op: Omit<OutboxOp, "id" | "createdAt">): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).add({ ...op, createdAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // File indisponible : l'écriture sera perdue hors ligne.
  }
}

export async function outboxAll(): Promise<OutboxOp[]> {
  try {
    const db = await openDb();
    return await new Promise<OutboxOp[]>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const req = tx.objectStore(OUTBOX_STORE).getAll();
      req.onsuccess = () => resolve((req.result as OutboxOp[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function outboxRemove(id: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignoré : on retentera au prochain cycle.
  }
}

export async function outboxCount(userId?: string | null): Promise<number> {
  const ops = await outboxAll();
  if (!userId) return ops.length;
  // Les opérations antérieures (sans userId) sont attribuées à l'utilisateur
  // courant, comme lors du rejeu.
  return ops.filter(op => !op.userId || op.userId === userId).length;
}
const DB_NAME = "viyie_music_db";
const STORE_NAME = "tracks";

export interface DBTrack {
  id: string;
  title: string;
  blob: Blob;
  addedAt: number;
}

export function initMusicDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveTrack(title: string, blob: Blob): Promise<DBTrack> {
  const db = await initMusicDb();
  const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const track: DBTrack = { id, title, blob, addedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(track);
    request.onsuccess = () => resolve(track);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTracks(): Promise<DBTrack[]> {
  const db = await initMusicDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await initMusicDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

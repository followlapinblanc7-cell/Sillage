import type { DayEntry, JournalState, Photo } from '../types';

const DB_NAME = 'sillage-photos';
const DB_VERSION = 1;
const STORE = 'blobs';

export function isInlineRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function isDataUrl(url: string): boolean {
  return /^data:/i.test(url);
}

export function isBlobUrl(url: string): boolean {
  return /^blob:/i.test(url);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Erreur IndexedDB'));
  });
}

export async function idbPutPhoto(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbRequest(tx.objectStore(STORE).put({ id, blob }));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Échec enregistrement photo'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
    });
  } finally {
    db.close();
  }
}

export async function idbGetPhoto(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const row = await idbRequest<{ id: string; blob: Blob } | undefined>(
      tx.objectStore(STORE).get(id),
    );
    return row?.blob;
  } finally {
    db.close();
  }
}

export async function idbDeletePhoto(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbRequest(tx.objectStore(STORE).delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Échec suppression photo'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
    });
  } finally {
    db.close();
  }
}

export async function idbDeletePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      store.delete(id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Échec suppression photos'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
    });
  } finally {
    db.close();
  }
}

export async function idbClearAll(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbRequest(tx.objectStore(STORE).clear());
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Échec vidage photos'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
    });
  } finally {
    db.close();
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new Error('Data URL invalide');
    const header = dataUrl.slice(0, comma);
    const data = dataUrl.slice(comma + 1);
    const mimeMatch = /data:([^;]+)/i.exec(header);
    const mime = mimeMatch?.[1] ?? 'image/jpeg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture photo impossible'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lecture photo impossible'));
    reader.readAsDataURL(blob);
  });
}

/** Strip data/blob URLs before writing to localStorage; keep https. */
export function stripPhotosForStorage(state: JournalState): JournalState {
  const days: Record<string, DayEntry> = {};
  for (const [dayId, day] of Object.entries(state.days)) {
    days[dayId] = {
      ...day,
      photos: day.photos.map((p) => {
        const url = p.url ?? '';
        if (isInlineRemoteUrl(url)) {
          return { id: p.id, url, pinned: p.pinned };
        }
        // data: / blob: / empty → persist id + pinned only
        return { id: p.id, url: '', pinned: p.pinned };
      }),
    };
  }
  return { ...state, days };
}

/**
 * Resolve every local photo to a data URL for export.
 * https URLs are left as-is (CORS may block fetch).
 */
export async function materializePhotosForExport(
  state: JournalState,
): Promise<JournalState> {
  const days: Record<string, DayEntry> = {};

  for (const [dayId, day] of Object.entries(state.days)) {
    const photos: Photo[] = [];
    for (const p of day.photos) {
      const url = p.url ?? '';
      if (isInlineRemoteUrl(url)) {
        photos.push({ ...p, url });
        continue;
      }
      if (isDataUrl(url)) {
        photos.push({ ...p, url });
        continue;
      }
      // blob: or empty — load from IDB
      try {
        let blob: Blob | undefined;
        if (isBlobUrl(url)) {
          try {
            const res = await fetch(url);
            blob = await res.blob();
          } catch {
            blob = await idbGetPhoto(p.id);
          }
        } else {
          blob = await idbGetPhoto(p.id);
        }
        if (blob) {
          photos.push({ ...p, url: await blobToDataUrl(blob) });
        } else {
          photos.push({ ...p, url: '' });
        }
      } catch {
        photos.push({ ...p, url: '' });
      }
    }
    days[dayId] = { ...day, photos };
  }

  return { ...state, days };
}

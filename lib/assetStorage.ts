// lib/assetStorage.ts
// Local IndexedDB storage for viewer assets (wallpapers, fonts, audio)
// Strictly client-side: ZERO network upload or server writes (per VF-12)

const DB_NAME = 'portos_viewer_vault';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

export interface StoredAsset {
  id: string;
  name: string;
  type: 'wallpaper-desktop' | 'wallpaper-lock' | 'font' | 'sound' | 'icon';
  mimeType: string;
  blob: Blob;
  dataUrl?: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save an asset locally into browser IndexedDB without any server request
 */
export async function saveViewerAsset(
  id: string,
  file: File | Blob,
  metadata: { name: string; type: StoredAsset['type'] }
): Promise<string> {
  const db = await openDB();

  // Convert to dataUrl for immediate usage
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const asset: StoredAsset = {
    id,
    name: metadata.name,
    type: metadata.type,
    mimeType: file.type || 'application/octet-stream',
    blob: file,
    dataUrl,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(asset);

    req.onsuccess = () => resolve(dataUrl);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a stored asset by ID
 */
export async function getViewerAsset(id: string): Promise<StoredAsset | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * List all viewer assets of a given type
 */
export async function listViewerAssets(type?: StoredAsset['type']): Promise<StoredAsset[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results: StoredAsset[] = req.result || [];
        if (type) {
          resolve(results.filter((a) => a.type === type));
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Delete a stored asset
 */
export async function deleteViewerAsset(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

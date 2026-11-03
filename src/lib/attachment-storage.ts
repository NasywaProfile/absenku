/**
 * IndexedDB storage for Absenku attachments (Dokumen PDF, Surat Dokter, Foto Resolusi Tinggi).
 * IndexedDB memiliki kuota penyimpanan hingga ratusan MB sampai GB,
 * terpisah dari batas ketat 5 MB localStorage browser.
 */

const DB_NAME = 'absenku_offline_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Menyimpan data URL (base64) atau berkas ke IndexedDB
 */
export async function storeAttachmentInIDB(id: string, dataUrl: string): Promise<string> {
  if (!dataUrl || !id) return id;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, id);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan berkas ke IndexedDB:', err);
    return id;
  }
}

/**
 * Mengambil data URL lampiran dari IndexedDB berdasarkan ID
 */
export async function getAttachmentFromIDB(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membaca berkas dari IndexedDB:', err);
    return null;
  }
}

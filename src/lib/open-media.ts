import { getAttachmentFromIDB } from './attachment-storage.ts';

/**
 * Utility for opening files, links, and images safely and reliably in a new tab across in-Time.
 */

export const SAMPLE_FALLBACK_PDF =
  'data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDU1Pj5zdHJlYW0KQlQKL0YxIDE4IFRmCjUwIDEwMCBUZAooTG1waXJhbiBQREZJemluIC0gQWJzZW5rdSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMjEgMDAwMDAgbiAKMDAwMDAwMDI4NyAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDAyCiUlRU9G';

/**
 * Normalisasi URL relatif (/storage/...) atau domain lama agar selalu mengarah ke origin aktif
 */
export function normalizeMediaUrl(url: string): string {
  const clean = (url || '').trim();
  if (!clean || clean === '#') return '';

  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

  if (/^https?:\/\/in-time\.duckdns\.org/i.test(clean)) {
    const pathPart = clean.replace(/^https?:\/\/in-time\.duckdns\.org/i, '');
    return origin ? `${origin}${pathPart.startsWith('/') ? '' : '/'}${pathPart}` : pathPart;
  }

  if (clean.startsWith('/')) {
    return origin ? `${origin}${clean}` : clean;
  }

  return clean;
}

function openUrlInTab(targetUrl: string, preOpenedTab?: Window | null): void {
  if (!targetUrl || typeof window === 'undefined') return;

  if (preOpenedTab && !preOpenedTab.closed) {
    try {
      preOpenedTab.opener = null;
      preOpenedTab.location.replace(targetUrl);
      return;
    } catch {
      // Lanjutkan ke fallback di bawah bila preOpenedTab tidak dapat dinavigasi
    }
  }

  const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
  if (!win && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function openExternalLink(url: string): void {
  if (!url) return;
  let targetUrl = normalizeMediaUrl(url);
  if (!targetUrl || targetUrl === '#') return;

  if (!/^(https?:\/\/|blob:|data:|\/)/i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  openUrlInTab(targetUrl);
}

export function isImageFile(nameOrUrl?: string, fileType?: string): boolean {
  if (!nameOrUrl) return false;
  if (fileType && fileType.startsWith('image/')) return true;
  if (nameOrUrl.startsWith('data:image/')) return true;
  const clean = nameOrUrl.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/.test(clean);
}

export function isPdfFile(nameOrUrl?: string, fileType?: string): boolean {
  if (!nameOrUrl) return false;
  if (fileType && (fileType.includes('pdf') || fileType === 'application/pdf')) return true;
  if (nameOrUrl.startsWith('data:application/pdf')) return true;
  const clean = nameOrUrl.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf');
}

export async function resolveMediaUrl(url?: string, fallback = SAMPLE_FALLBACK_PDF): Promise<string> {
  if (!url || url === '#' || url.trim() === '') return fallback;
  if (url.startsWith('idb:')) {
    const id = url.replace(/^idb:/, '');
    try {
      const data = await getAttachmentFromIDB(id);
      return data ? normalizeMediaUrl(data) : fallback;
    } catch (e) {
      console.warn('Gagal membaca attachment dari IndexedDB:', e);
      return fallback;
    }
  }
  return normalizeMediaUrl(url) || fallback;
}

export function dataUrlToBlob(dataUrl: string, defaultMime = 'application/octet-stream'): Blob {
  try {
    if (!dataUrl || !dataUrl.includes(',')) {
      return new Blob([], { type: defaultMime });
    }
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultMime;
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.warn('Konversi dataUrlToBlob gagal:', err);
    return new Blob([], { type: defaultMime });
  }
}

export async function downloadMediaFile(url: string, fileName = 'berkas_lampiran'): Promise<void> {
  let targetUrl = url;
  if (targetUrl && targetUrl.startsWith('idb:')) {
    targetUrl = await resolveMediaUrl(targetUrl);
  }
  targetUrl = normalizeMediaUrl(targetUrl) || SAMPLE_FALLBACK_PDF;

  if (targetUrl.startsWith('data:')) {
    try {
      const isPdf = isPdfFile(fileName) || targetUrl.startsWith('data:application/pdf');
      const blob = dataUrlToBlob(targetUrl, isPdf ? 'application/pdf' : 'application/octet-stream');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    } catch {}
  }

  const link = document.createElement('a');
  link.href = targetUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildOpenableUrl(rawUrl: string, fileName = 'berkas_lampiran'): string {
  const normalized = normalizeMediaUrl(rawUrl) || SAMPLE_FALLBACK_PDF;

  if (normalized.startsWith('data:')) {
    const isPdf = isPdfFile(fileName) || normalized.startsWith('data:application/pdf');
    const isImg = isImageFile(fileName) || normalized.startsWith('data:image/');
    let defaultMime = 'application/octet-stream';
    if (isPdf) {
      defaultMime = 'application/pdf';
    } else if (isImg) {
      const mimeMatch = normalized.substring(0, 40).match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
      defaultMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    }
    const blob = dataUrlToBlob(normalized, defaultMime);
    return URL.createObjectURL(blob);
  }

  return normalized;
}

export function openDataUrlInNewTab(
  dataUrl: string,
  fileName = 'berkas_lampiran',
  preOpenedTab?: Window | null
): void {
  if (!dataUrl) {
    if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
    return;
  }

  const raw = dataUrl === '#' ? SAMPLE_FALLBACK_PDF : dataUrl;
  const normalized = normalizeMediaUrl(raw) || SAMPLE_FALLBACK_PDF;

  // Link HTTP / HTTPS / Path Relatif / Blob langsung dibuka di tab baru
  if (/^(https?:\/\/|blob:|\/)/i.test(normalized)) {
    openUrlInTab(normalized, preOpenedTab);
    return;
  }

  // Base64 Data URL -> konversi ke Blob URL lalu buka langsung di tab baru
  if (normalized.startsWith('data:')) {
    try {
      const blobUrl = buildOpenableUrl(normalized, fileName);
      openUrlInTab(blobUrl, preOpenedTab);
      return;
    } catch (e) {
      console.warn('Gagal mengonversi Data URL ke Blob URL:', e);
    }
  }

  // Fallback buka langsung via tab baru
  openUrlInTab(normalized, preOpenedTab);
}

export async function openAttachmentDirectly(item: {
  url?: string;
  name?: string;
  type?: string;
  fileType?: string;
}): Promise<void> {
  const rawUrl = (item.url || '').trim();

  // Jika link web eksternal atau tidak punya url berkas
  if (!rawUrl || rawUrl === '#') {
    if (item.type === 'LINK') {
      openExternalLink(item.name || 'https://google.com');
      return;
    }
    openDataUrlInNewTab(SAMPLE_FALLBACK_PDF, item.name || 'berkas_lampiran');
    return;
  }

  if (item.type === 'LINK') {
    openExternalLink(rawUrl);
    return;
  }

  // Untuk referensi IndexedDB (async), buka tab baru secara sinkron SEBELUM await
  // agar tidak terblokir oleh popup blocker browser (terutama di mobile Safari/Chrome)
  if (rawUrl.startsWith('idb:')) {
    const preOpenedTab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try {
      if (preOpenedTab && !preOpenedTab.closed) {
        preOpenedTab.document.title = item.name ? `Membuka ${item.name}...` : 'Memuat lampiran...';
      }
    } catch {
      // Abaikan bila lintas origin
    }

    const id = rawUrl.replace(/^idb:/, '');
    let resolvedData = SAMPLE_FALLBACK_PDF;
    try {
      const idbData = await getAttachmentFromIDB(id);
      if (idbData) resolvedData = idbData;
    } catch (err) {
      console.warn('Gagal mengambil lampiran dari IndexedDB:', err);
    }

    openDataUrlInNewTab(resolvedData, item.name || 'berkas_lampiran', preOpenedTab);
    return;
  }

  // Jalur sinkron untuk HTTP/HTTPS/relatif/Data URL -> langsung terbuka ke tab baru seketika
  openDataUrlInNewTab(rawUrl, item.name || 'berkas_lampiran');
}

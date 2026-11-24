import { getAttachmentFromIDB } from './attachment-storage.ts';

/**
 * Utility for opening files, links, and images safely and reliably in a new tab across in-Time.
 */

const SAFE_DATA_MIME_RE =
  /^data:(image\/(?:png|jpe?g|webp|gif|bmp|avif)|application\/pdf|video\/(?:mp4|webm|quicktime|x-matroska)|application\/(?:msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation|zip|x-zip-compressed|octet-stream)|text\/(?:plain|csv))(?:;[a-zA-Z0-9=._+-]+)*;base64,/i;

function stripControlChars(value: string): string {
  return (value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

export function isSafeDataUrl(dataUrl: string): boolean {
  const clean = stripControlChars(dataUrl);
  if (!/^data:/i.test(clean)) return false;
  if (/data:\s*(?:text\/html|image\/svg\+xml|application\/xhtml\+xml|(?:text|application)\/(?:javascript|x-javascript|ecmascript|xml))/i.test(clean)) {
    return false;
  }
  return SAFE_DATA_MIME_RE.test(clean);
}

export function isSafeMediaUrl(url: string): boolean {
  const clean = stripControlChars(url);
  if (!clean || clean === '#') return false;
  if (/^https?:\/\//i.test(clean)) return true;
  if (/^\/(?!\/)/.test(clean)) return true;
  if (/^idb:/i.test(clean)) return true;
  if (/^blob:/i.test(clean)) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return clean.startsWith(`blob:${window.location.origin}/`);
    }
    return false;
  }
  if (/^data:/i.test(clean)) {
    return isSafeDataUrl(clean);
  }
  return false;
}

/**
 * Normalisasi URL relatif (/storage/...) atau domain lama agar selalu mengarah ke origin aktif
 */
export function normalizeMediaUrl(url: string): string {
  const clean = stripControlChars(url);
  if (!clean || clean === '#') return '';

  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

  // 1. Ekstrak path /storage/ atau /api/storage/ jika tersimpan dengan localhost/IP/domain lain
  const storageMatch = clean.match(/(?:\/(?:api\/)?storage\/[^\s"'>#]+)/i);
  if (storageMatch) {
    const storagePath = storageMatch[0];
    return origin ? `${origin}${storagePath.startsWith('/') ? '' : '/'}${storagePath}` : storagePath;
  }

  // 2. Rewrite domain lama in-time.duckdns.org jika sedang diakses dari origin lain (misal IP VPS atau domain baru)
  if (/^https?:\/\/in-time\.duckdns\.org/i.test(clean)) {
    const pathPart = clean.replace(/^https?:\/\/in-time\.duckdns\.org/i, '');
    return origin ? `${origin}${pathPart.startsWith('/') ? '' : '/'}${pathPart}` : pathPart;
  }

  // 3. Path relatif murni (/uploads/..., /assets/...)
  if (/^\/(?!\/)/.test(clean)) {
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

export function sanitizeExternalLinkUrl(url: string): string {
  const raw = stripControlChars(url);
  if (!raw || raw === '#') return '';
  let targetUrl = normalizeMediaUrl(raw);
  if (!targetUrl || targetUrl === '#') return '';

  // Tolak eksplisit protokol berbahaya (javascript:, vbscript:, data:, file:, blob:, //host)
  if (/^\/\//.test(targetUrl)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl)) {
    return /^https?:\/\//i.test(targetUrl) ? targetUrl : '';
  }

  if (!targetUrl.startsWith('/')) {
    targetUrl = 'https://' + targetUrl;
  }
  return targetUrl;
}

export function openExternalLink(url: string): void {
  const targetUrl = sanitizeExternalLinkUrl(url);
  if (!targetUrl) return;
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

export async function resolveMediaUrl(url?: string, fallback = ''): Promise<string> {
  if (!url || url === '#' || url.trim() === '') return fallback;
  if (url.startsWith('idb:')) {
    const id = url.replace(/^idb:/, '');
    try {
      const data = await getAttachmentFromIDB(id);
      if (data) return normalizeMediaUrl(data) || fallback;
      console.warn('[resolveMediaUrl] Lampiran IndexedDB tidak ditemukan di device ini:', id);
      return fallback;
    } catch (e) {
      console.warn('Gagal membaca attachment dari IndexedDB:', e);
      return fallback;
    }
  }
  return normalizeMediaUrl(url) || fallback;
}

export function dataUrlToBlob(dataUrl: string, defaultMime = 'application/octet-stream'): Blob {
  try {
    if (!dataUrl || !dataUrl.includes(',') || !isSafeDataUrl(dataUrl)) {
      return new Blob([], { type: 'application/octet-stream' });
    }
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultMime;
    const safeMime = /(?:html|svg|xml|script|ecmascript)/i.test(mime) ? 'application/octet-stream' : mime;
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: safeMime });
  } catch (err) {
    console.warn('Konversi dataUrlToBlob gagal:', err);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

export async function downloadMediaFile(url: string, fileName = 'berkas_lampiran'): Promise<void> {
  const safeFileName = (fileName || 'berkas_lampiran').replace(/[\\/:*?"<>|]/g, '_');
  let targetUrl = url;
  if (targetUrl && targetUrl.startsWith('idb:')) {
    targetUrl = await resolveMediaUrl(targetUrl);
  }
  targetUrl = normalizeMediaUrl(targetUrl);
  if (!targetUrl) return;

  if (!isSafeMediaUrl(targetUrl)) {
    console.warn('[downloadMediaFile] URL berkas tidak aman ditolak:', targetUrl);
    return;
  }

  if (/^data:/i.test(targetUrl)) {
    try {
      const isPdf = isPdfFile(safeFileName) || targetUrl.toLowerCase().startsWith('data:application/pdf');
      const blob = dataUrlToBlob(targetUrl, isPdf ? 'application/pdf' : 'application/octet-stream');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    } catch {}
  }

  const link = document.createElement('a');
  link.href = targetUrl;
  link.download = safeFileName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildOpenableUrl(rawUrl: string, fileName = 'berkas_lampiran'): string {
  const normalized = normalizeMediaUrl(rawUrl);
  if (!normalized) return '';

  if (/^data:/i.test(normalized)) {
    if (!isSafeDataUrl(normalized)) {
      return '';
    }
    const isPdf = isPdfFile(fileName) || normalized.toLowerCase().startsWith('data:application/pdf');
    const isImg = isImageFile(fileName) || normalized.toLowerCase().startsWith('data:image/');
    let defaultMime = 'application/octet-stream';
    if (isPdf) {
      defaultMime = 'application/pdf';
    } else if (isImg) {
      const mimeMatch = normalized.substring(0, 60).match(/^data:(image\/(?:png|jpe?g|webp|gif|bmp|avif));/i);
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
  const closePreOpened = () => {
    if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
  };

  if (!dataUrl || dataUrl === '#') {
    closePreOpened();
    return;
  }

  const normalized = normalizeMediaUrl(dataUrl);
  if (!normalized) {
    closePreOpened();
    return;
  }

  // Link HTTP / HTTPS / Path Relatif tunggal langsung dibuka di tab baru
  if (/^https?:\/\//i.test(normalized) || /^\/(?!\/)/.test(normalized)) {
    openUrlInTab(normalized, preOpenedTab);
    return;
  }

  if (/^blob:/i.test(normalized)) {
    const isSameOriginBlob =
      typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      normalized.startsWith(`blob:${window.location.origin}/`);
    if (isSameOriginBlob) {
      openUrlInTab(normalized, preOpenedTab);
    } else {
      console.warn('[openDataUrlInNewTab] Blob URL lintas-origin ditolak');
      closePreOpened();
    }
    return;
  }

  // Base64 Data URL -> wajib lolos validasi MIME aman (anti data:text/html / SVG XSS)
  if (/^data:/i.test(normalized)) {
    if (!isSafeDataUrl(normalized)) {
      console.warn('[openDataUrlInNewTab] Data URL tidak aman ditolak');
      closePreOpened();
      return;
    }
    try {
      const blobUrl = buildOpenableUrl(normalized, fileName);
      if (blobUrl) {
        openUrlInTab(blobUrl, preOpenedTab);
      } else {
        closePreOpened();
      }
      return;
    } catch (e) {
      console.warn('Gagal mengonversi Data URL ke Blob URL:', e);
      closePreOpened();
      return;
    }
  }

  // Tolak skema berbahaya lainnya (javascript:, vbscript:, file:, //host)
  console.warn('[openDataUrlInNewTab] Skema URL tidak diizinkan ditolak:', normalized);
  closePreOpened();
}

export async function openAttachmentDirectly(item: {
  url?: string;
  name?: string;
  type?: string;
  fileType?: string;
}): Promise<void> {
  const rawUrl = stripControlChars(item.url || '');

  // Jika link web eksternal atau tidak punya url berkas
  if (!rawUrl || rawUrl === '#') {
    if (item.type === 'LINK') {
      const linkTarget = item.name && /^https?:\/\//i.test(item.name) ? item.name : '';
      if (linkTarget) {
        openExternalLink(linkTarget);
      } else {
        alert('Tautan web tidak tersedia atau belum ditentukan.');
      }
      return;
    }
    alert('Lampiran berkas tidak ditemukan atau belum diunggah.');
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
        preOpenedTab.opener = null;
        preOpenedTab.document.title = item.name ? `Membuka ${item.name}...` : 'Memuat lampiran...';
      }
    } catch {
      // Abaikan bila lintas origin
    }

    const id = rawUrl.replace(/^idb:/, '');
    let resolvedData: string | null = null;
    try {
      resolvedData = await getAttachmentFromIDB(id);
    } catch (err) {
      console.warn('Gagal mengambil lampiran dari IndexedDB:', err);
    }

    if (!resolvedData) {
      // File hanya tersimpan di perangkat yang mengunggah — tidak bisa dibuka di perangkat lain
      if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
      alert(
        'Lampiran tidak dapat dibuka.\n\nBerkas ini hanya tersimpan secara lokal di perangkat yang mengunggahnya (penyimpanan offline). ' +
        'Silakan unggah ulang saat koneksi internet aktif agar dapat diakses dari perangkat lain.'
      );
      return;
    }

    openDataUrlInNewTab(resolvedData, item.name || 'berkas_lampiran', preOpenedTab);
    return;
  }

  // Jalur sinkron untuk HTTP/HTTPS/relatif/Data URL -> langsung terbuka ke tab baru seketika
  openDataUrlInNewTab(rawUrl, item.name || 'berkas_lampiran');
}

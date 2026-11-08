import { getAttachmentFromIDB } from './attachment-storage.ts';

/**
 * Utility for opening files, links, and images safely and reliably across in-Time.
 */

export const SAMPLE_FALLBACK_PDF =
  'data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDU1Pj5zdHJlYW0KQlQKL0YxIDE4IFRmCjUw IDEwMCBUZAooTG1waXJhbiBQREZJemluIC0gQWJzZW5rdSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMjEgMDAwMDAgbiAKMDAwMDAwMDI4NyAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDAyCiUlRU9G';

export function openExternalLink(url: string): void {
  if (!url) return;
  let targetUrl = url.trim();
  if (targetUrl === '#' || !targetUrl) return;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }
  const link = document.createElement('a');
  link.href = targetUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
      return data || fallback;
    } catch (e) {
      console.warn('Gagal membaca attachment dari IndexedDB:', e);
      return fallback;
    }
  }
  return url;
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
  if (!targetUrl || targetUrl === '#') targetUrl = SAMPLE_FALLBACK_PDF;

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

export function openDataUrlInNewTab(dataUrl: string, fileName = 'berkas_lampiran'): void {
  if (!dataUrl) return;

  const targetUrl = dataUrl === '#' ? SAMPLE_FALLBACK_PDF : dataUrl;

  // HTTP or HTTPS Web links
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    openExternalLink(targetUrl);
    return;
  }

  // Base64 Data URLs -> Convert to Blob URL
  if (targetUrl.startsWith('data:')) {
    try {
      const isPdf = isPdfFile(fileName) || targetUrl.startsWith('data:application/pdf');
      const isImg = isImageFile(fileName) || targetUrl.startsWith('data:image/');
      let defaultMime = 'application/octet-stream';
      if (isPdf) {
        defaultMime = 'application/pdf';
      } else if (isImg) {
        const mimeMatch = targetUrl.substring(0, 35).match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
        defaultMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      }
      const blob = dataUrlToBlob(targetUrl, defaultMime);
      const blobUrl = URL.createObjectURL(blob);

      const win = window.open(blobUrl, '_blank');
      if (!win) {
        // Fallback jika popup diblokir oleh browser
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    } catch (e) {
      console.warn('Failed to convert base64 to Blob URL:', e);
    }
  }

  // Fallback: download directly
  downloadMediaFile(targetUrl, fileName);
}

export async function openAttachmentDirectly(item: {
  url?: string;
  name?: string;
  type?: string;
  fileType?: string;
}): Promise<void> {
  let targetUrl = item.url;
  if (!targetUrl || targetUrl === '#') {
    if (item.type === 'LINK') {
      openExternalLink(item.name || 'https://google.com');
      return;
    }
    targetUrl = SAMPLE_FALLBACK_PDF;
  }

  // Jika berupa referensi IndexedDB (idb:...)
  if (targetUrl && targetUrl.startsWith('idb:')) {
    const id = targetUrl.replace('idb:', '');
    const idbData = await getAttachmentFromIDB(id);
    targetUrl = idbData || SAMPLE_FALLBACK_PDF;
  }

  if (item.type === 'LINK') {
    openExternalLink(targetUrl);
    return;
  }

  openDataUrlInNewTab(targetUrl, item.name || 'berkas_lampiran');
}

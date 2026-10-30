/**
 * Utility for opening files, links, and images safely and reliably across Absenku.
 */

export const SAMPLE_FALLBACK_PDF =
  'data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDU1Pj5zdHJlYW0KQlQKL0YxIDE4IFRmCjUwIDEwMCBUZAooTG1waXJhbiBQREZJemluIC0gQWJzZW5rdSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMjEgMDAwMDAgbiAKMDAwMDAwMDI4NyAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDAyCiUlRU9G';

export function openExternalLink(url: string): void {
  if (!url) return;
  let targetUrl = url.trim();
  if (targetUrl === '#' || !targetUrl) return;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
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

export function downloadMediaFile(url: string, fileName = 'berkas_lampiran'): void {
  const targetUrl = !url || url === '#' ? SAMPLE_FALLBACK_PDF : url;
  const link = document.createElement('a');
  link.href = targetUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function openAttachmentDirectly(item: {
  url?: string;
  name?: string;
  type?: string;
  fileType?: string;
}): void {
  let targetUrl = item.url;
  if (!targetUrl || targetUrl === '#') {
    if (item.type === 'LINK') {
      openExternalLink(item.name || 'https://google.com');
      return;
    }
    targetUrl = SAMPLE_FALLBACK_PDF;
  }

  if (item.type === 'LINK') {
    openExternalLink(targetUrl);
    return;
  }

  // If it's a web URL (http / https)
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // If it's a PDF data url or PDF file
  if (isPdfFile(targetUrl, item.fileType) || isPdfFile(item.name, item.fileType)) {
    const win = window.open();
    if (win) {
      win.document.title = item.name || 'Dokumen_Lampiran.pdf';
      win.document.write(
        `<body style="margin:0; background:#1e293b; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden;">
          <iframe src="${targetUrl}" frameborder="0" style="width:100%; height:100%; border:none;" title="${item.name || 'Dokumen'}"></iframe>
        </body>`
      );
      win.document.close();
    } else {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  // If it's an image data URL
  if (isImageFile(targetUrl, item.fileType) || isImageFile(item.name, item.fileType)) {
    const win = window.open();
    if (win) {
      win.document.title = item.name || 'Foto_Lampiran';
      win.document.write(
        `<body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;">
          <img src="${targetUrl}" style="max-width:95vw; max-height:95vh; object-fit:contain; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);" alt="${item.name || 'Lampiran'}" />
        </body>`
      );
      win.document.close();
    } else {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  // Other binary data: download directly
  downloadMediaFile(targetUrl, item.name);
}

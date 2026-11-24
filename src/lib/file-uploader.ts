import { uploadToCloudinary } from './cloudinary';
import { compressImageFile } from './image-compression';
import { storeAttachmentInIDB } from './attachment-storage';
import { ApiClient } from './api-client';
import { normalizeMediaUrl } from './open-media';

export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024,      // Maksimal 5 MB untuk foto/gambar
  VIDEO: 25 * 1024 * 1024,     // Maksimal 25 MB untuk video
  DOCUMENT: 15 * 1024 * 1024,  // Maksimal 15 MB untuk dokumen (PDF, Word, Excel, ZIP)
};

export const ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  video: ['mp4', 'webm', 'mov', 'mkv'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'csv', 'txt'],
};

// Ekstensi berbahaya yang wajib ditolak demi keamanan server & pencegahan XSS
export const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'phar', 'svg', 'html', 'htm', 'xhtml',
  'js', 'mjs', 'msi', 'vbs', 'scr', 'com', 'pif', 'py', 'jar'
];

export type FileCategory = 'image' | 'video' | 'document' | 'unknown';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  category: FileCategory;
  extension: string;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
  category: FileCategory;
  storage: 'cloudinary' | 'vps' | 'local_fallback';
  publicId?: string;
}

/**
 * Menentukan kategori file berdasarkan MIME type atau ekstensi nama file
 */
export function getFileCategory(file: File | { name: string; type?: string }): FileCategory {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type?.toLowerCase() || '';

  if (mime.startsWith('image/') || ALLOWED_EXTENSIONS.image.includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ALLOWED_EXTENSIONS.video.includes(ext)) {
    return 'video';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('zip') ||
    mime.includes('text') ||
    ALLOWED_EXTENSIONS.document.includes(ext)
  ) {
    return 'document';
  }
  return 'unknown';
}

/**
 * Validasi ketat untuk ukuran dan jenis file
 */
export function validateFile(file: File): FileValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const category = getFileCategory(file);

  // 1. Blokir ekstensi berbahaya
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `Format file .${ext} dilarang demi keamanan sistem.`,
      category: 'unknown',
      extension: ext,
    };
  }

  // 2. Validasi per kategori
  if (category === 'image') {
    if (file.size > FILE_SIZE_LIMITS.IMAGE) {
      return {
        isValid: false,
        error: `Ukuran foto terlalu besar. Maksimal ukuran foto adalah 5 MB.`,
        category,
        extension: ext,
      };
    }
    return { isValid: true, category, extension: ext };
  }

  if (category === 'video') {
    if (file.size > FILE_SIZE_LIMITS.VIDEO) {
      return {
        isValid: false,
        error: `Ukuran video terlalu besar. Maksimal ukuran video adalah 25 MB.`,
        category,
        extension: ext,
      };
    }
    return { isValid: true, category, extension: ext };
  }

  if (category === 'document') {
    if (file.size > FILE_SIZE_LIMITS.DOCUMENT) {
      return {
        isValid: false,
        error: `Maksimal ukuran dokumen adalah 15 MB.`,
        category,
        extension: ext,
      };
    }
    return { isValid: true, category, extension: ext };
  }

  // File tidak dikenal
  return {
    isValid: false,
    error: `Format file .${ext || 'tidak dikenal'} tidak didukung. Harap unggah foto, video, atau dokumen (PDF, Word, Excel, ZIP).`,
    category: 'unknown',
    extension: ext,
  };
}

/**
 * Helper internal untuk mengunggah berkas ke VPS backend storage (/api/upload)
 */
async function uploadFileToVPS(
  file: File,
  category: FileCategory
): Promise<{ url: string; size: number; type: string } | null> {
  const uploadEndpoints = [
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
      ? `${(import.meta as any).env.VITE_API_URL}/upload`
      : null),
    '/api/upload',
  ].filter(Boolean) as string[];

  for (const endpoint of uploadEndpoints) {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('file', file);
      formData.append('category', category);

      const token = ApiClient.getToken();
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const rawUrl = data?.relative_url || data?.url;
        if (rawUrl) {
          return {
            url: normalizeMediaUrl(rawUrl),
            size: data.size || file.size,
            type: data.type || file.type || 'application/octet-stream',
          };
        }
      }
    } catch (vpsErr) {
      console.warn(`Upload berkas ke ${endpoint} gagal:`, vpsErr);
    }
  }
  return null;
}

/**
 * Unggah berkas secara hybrid:
 * - Foto/Gambar: Dikompresi otomatis di browser -> diunggah ke Cloudinary atau VPS
 * - Video: Diunggah ke Cloudinary atau VPS
 * - Dokumen (PDF, Word, ZIP): Diunggah ke VPS (Endpoint /api/upload)
 */
export async function uploadHybridFile(
  file: File,
  options: {
    folder?: string;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<UploadResult> {
  // 1. Jalankan validasi jenis dan ukuran
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const { category } = validation;
  const folder = options.folder || (category === 'document' ? 'absenku/documents' : 'absenku/media');

  // -------------------------------------------------------------
  // KASUS 1: FOTO / GAMBAR -> Kompres dulu -> Kirim ke Cloudinary / VPS
  // -------------------------------------------------------------
  if (category === 'image') {
    try {
      // Kompres otomatis gambar ke ukuran maksimal 1280px dan kualitas 80%
      // Mengubah foto kamera HP 5-10 MB menjadi hanya ~100-200 KB
      const compressedDataUrl = await compressImageFile(file, 1280, 1280, 0.8);

      const cloudRes = await uploadToCloudinary(compressedDataUrl, {
        folder,
        resourceType: 'image',
      });

      return {
        url: cloudRes.url,
        name: file.name,
        size: cloudRes.bytes || file.size,
        type: file.type || 'image/jpeg',
        category: 'image',
        storage: 'cloudinary',
        publicId: cloudRes.publicId,
      };
    } catch (err) {
      console.warn('Gagal upload gambar ke Cloudinary, mencoba upload ke backend VPS:', err);
      // Coba upload file asli ke backend VPS
      const vpsRes = await uploadFileToVPS(file, 'image');
      if (vpsRes) {
        return {
          url: vpsRes.url,
          name: file.name,
          size: vpsRes.size,
          type: vpsRes.type || file.type || 'image/jpeg',
          category: 'image',
          storage: 'vps',
        };
      }

      // Fallback: gunakan data URL terkompresi
      const compressedDataUrl = await compressImageFile(file, 800, 800, 0.7);
      let returnUrl = compressedDataUrl;
      if (compressedDataUrl.length > 50000) {
        const attId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await storeAttachmentInIDB(attId, compressedDataUrl);
        returnUrl = `idb:${attId}`;
      }
      return {
        url: returnUrl,
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        category: 'image',
        storage: 'local_fallback',
      };
    }
  }

  // -------------------------------------------------------------
  // KASUS 2: VIDEO -> Kirim ke Cloudinary atau VPS
  // -------------------------------------------------------------
  if (category === 'video') {
    try {
      const cloudRes = await uploadToCloudinary(file, {
        folder,
        resourceType: 'auto',
      });

      return {
        url: cloudRes.url,
        name: file.name,
        size: cloudRes.bytes || file.size,
        type: file.type || 'video/mp4',
        category: 'video',
        storage: 'cloudinary',
        publicId: cloudRes.publicId,
      };
    } catch (err) {
      console.warn('Gagal upload video ke Cloudinary, mencoba upload ke backend VPS:', err);
      const vpsRes = await uploadFileToVPS(file, 'video');
      if (vpsRes) {
        return {
          url: vpsRes.url,
          name: file.name,
          size: vpsRes.size,
          type: vpsRes.type || file.type || 'video/mp4',
          category: 'video',
          storage: 'vps',
        };
      }
      throw new Error('Gagal mengunggah video. Pastikan koneksi stabil atau coba kompres video terlebih dahulu.');
    }
  }

  // -------------------------------------------------------------
  // KASUS 3: DOKUMEN (PDF, Word, Excel, ZIP) -> Upload ke VPS Backend Storage
  // (Cloudinary default memblokir delivery PDF raw dengan 401 ACL failure)
  // -------------------------------------------------------------
  if (category === 'document') {
    // 1. Upload ke server backend VPS /api/upload (tersimpan permanen di disk publik)
    const vpsRes = await uploadFileToVPS(file, 'document');
    if (vpsRes) {
      return {
        url: vpsRes.url,
        name: file.name,
        size: vpsRes.size,
        type: vpsRes.type || file.type || 'application/octet-stream',
        category: 'document',
        storage: 'vps',
      };
    }

    // 2. Fallback jika offline (Data URL)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return {
      url: dataUrl,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      category: 'document',
      storage: 'local_fallback',
    };
  }

  throw new Error('Kategori file tidak didukung.');
}

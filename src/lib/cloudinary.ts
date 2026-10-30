/**
 * Cloudinary Direct Upload Service for Absenku
 * Cloud Name: bztonxus
 * Upload Preset: absenku_preset
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'bztonxus',
  uploadPreset: 'absenku_preset',
};

export interface CloudinaryUploadResult {
  url: string; // secure_url
  publicId: string;
  originalFilename?: string;
  format?: string;
  bytes?: number;
  resourceType?: string;
}

export interface UploadOptions {
  folder?: string;
  tags?: string[];
  resourceType?: 'auto' | 'image' | 'raw';
}

/**
 * Upload a File, Blob, or Base64 Data URL to Cloudinary
 */
export async function uploadToCloudinary(
  file: File | Blob | string,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const { folder = 'absenku', tags = ['absenku'], resourceType = 'auto' } = options;
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  if (folder) {
    formData.append('folder', folder);
    formData.append('asset_folder', folder);
  }
  if (tags && tags.length > 0) {
    formData.append('tags', tags.join(','));
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Gagal mengunggah berkas ke Cloudinary (${response.status})`
    );
  }

  const data = await response.json();

  return {
    url: data.secure_url || data.url,
    publicId: data.public_id,
    originalFilename: data.original_filename,
    format: data.format,
    bytes: data.bytes,
    resourceType: data.resource_type,
  };
}

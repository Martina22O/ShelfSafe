import { createClient } from './supabase/client';
import { formatErrorMessage } from './error';

interface CachedSignedUrl {
  url: string;
  expiresAt: number; // ms timestamp
}

const signedUrlCache = new Map<string, CachedSignedUrl>();

/**
 * Generates an RFC 4122 version 4 UUID.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves a cryptographically signed URL for a private storage path.
 * Caches URLs for 24 hours (86,400 seconds) and refreshes with a 5-minute safety buffer.
 */
export async function getSignedPhotoUrl(
  path: string | null | undefined
): Promise<string | null> {
  if (!path || !path.trim()) return null;
  const cleanPath = path.trim();

  const cached = signedUrlCache.get(cleanPath);
  const now = Date.now();
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.url;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('product-photos')
      .createSignedUrl(cleanPath, 86400); // 24 hours

    if (error || !data?.signedUrl) {
      return null;
    }

    signedUrlCache.set(cleanPath, {
      url: data.signedUrl,
      expiresAt: now + 86400 * 1000,
    });

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Invalidates a cached signed URL.
 */
export function invalidateSignedUrl(path: string | null | undefined) {
  if (path) {
    signedUrlCache.delete(path.trim());
  }
}

/**
 * Compresses an image file in the browser while strictly preserving its original aspect ratio.
 * Limits max dimension to 1200px and exports as a WebP (or JPEG fallback) Blob.
 */
export async function compressImageWeb(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1200;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          'image/webp',
          0.82
        );
      } else {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads an image file to the private product-photos storage bucket.
 */
export async function uploadProductPhotoWeb(
  file: File,
  productId: string
): Promise<{ storagePath: string } | { error: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Authentication required. Please sign in again.' };
    }

    const compressedBlob = await compressImageWeb(file);
    const filename = `photo_${Date.now()}.webp`;
    const storagePath = `${user.id}/${productId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('product-photos')
      .upload(storagePath, compressedBlob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      return { error: uploadError.message || 'Failed to upload photo.' };
    }

    return { storagePath };
  } catch (err: unknown) {
    return { error: formatErrorMessage(err) || 'Network error during photo upload.' };
  }
}

/**
 * Safely deletes a file from the private product-photos storage bucket.
 */
export async function deleteProductPhoto(
  storagePath: string | null | undefined
): Promise<boolean> {
  if (!storagePath || !storagePath.trim()) return true;
  try {
    const cleanPath = storagePath.trim();
    signedUrlCache.delete(cleanPath);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from('product-photos')
      .remove([cleanPath]);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Calls the dedicated set_product_image RPC.
 */
export async function setProductImage(
  productId: string,
  storagePath: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc('set_product_image', {
      p_product_id: productId,
      p_image_url: storagePath ? storagePath.trim() : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: formatErrorMessage(err) || 'Failed to update product photo.' };
  }
}

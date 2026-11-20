import { supabase } from './supabase';

interface CachedSignedUrl {
  url: string;
  expiresAt: number; // ms timestamp
}

// In-memory cache for signed URLs to prevent constant re-signing
const signedUrlCache = new Map<string, CachedSignedUrl>();

/**
 * Generates an RFC 4122 version 4 UUID.
 * Works seamlessly across Node, web, and React Native runtimes.
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
  // If cached and still valid for more than 5 minutes, return cached URL
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.url;
  }

  try {
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
 * Invalidates a cached signed URL (e.g. if image loading failed).
 */
export function invalidateSignedUrl(path: string | null | undefined) {
  if (path) {
    signedUrlCache.delete(path.trim());
  }
}

/**
 * Uploads a local photo to the private product-photos storage bucket.
 * Non-destructive: preserves the photo's original aspect ratio.
 */
export async function uploadProductPhoto(
  imageUri: string,
  productId: string
): Promise<{ storagePath: string } | { error: string }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Authentication required. Please sign in again.' };
    }

    // Determine extension from URI
    const isPng = /\.png($|\?)/i.test(imageUri);
    const ext = isPng ? 'png' : 'jpg';
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const filename = `photo_${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${productId}/${filename}`;

    // Convert local URI to blob using standard React Native fetch
    const response = await fetch(imageUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('product-photos')
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { error: uploadError.message || 'Failed to upload photo.' };
    }

    return { storagePath };
  } catch (err: any) {
    return { error: err?.message || 'Network error during photo upload.' };
  }
}

/**
 * Safely deletes a file from the private product-photos storage bucket.
 * Swallows errors to prevent non-critical storage failures from crashing product workflows.
 */
export async function deleteProductPhoto(
  storagePath: string | null | undefined
): Promise<boolean> {
  if (!storagePath || !storagePath.trim()) return true;
  try {
    const cleanPath = storagePath.trim();
    signedUrlCache.delete(cleanPath);
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
    const { error } = await supabase.rpc('set_product_image', {
      p_product_id: productId,
      p_image_url: storagePath ? storagePath.trim() : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update product photo.' };
  }
}

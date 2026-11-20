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
 * Converts a Base64 string into an ArrayBuffer without external dependencies.
 * Uses the global atob function available in React Native.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanB64 = base64.replace(/[\r\n\s]/g, '');
  const binaryString = atob(cleanB64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB storage limit

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

    let arrayBuffer: ArrayBuffer;
    let mimeType = 'image/jpeg';
    let ext = 'jpg';

    if (imageUri.includes(';base64,')) {
      const parts = imageUri.split(';base64,');
      const header = parts[0];
      const b64Data = parts[1];

      if (/image\/png/i.test(header)) {
        mimeType = 'image/png';
        ext = 'png';
      } else if (/image\/webp/i.test(header)) {
        mimeType = 'image/webp';
        ext = 'webp';
      } else {
        mimeType = 'image/jpeg';
        ext = 'jpg';
      }

      arrayBuffer = base64ToArrayBuffer(b64Data);
    } else {
      // Direct URI or fallback
      const isPng = /\.png($|\?)/i.test(imageUri);
      const isWebp = /\.webp($|\?)/i.test(imageUri);
      ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg';
      mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

      const response = await fetch(imageUri);
      arrayBuffer = await response.arrayBuffer();
    }

    // Validation: nonempty
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return { error: 'Photo data is empty or corrupted. Please choose another image.' };
    }

    // Validation: 2MB limit
    if (arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
      return { error: 'Photo exceeds maximum allowed size of 2 MB. Please select a smaller photo.' };
    }

    const filename = `photo_${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${productId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('product-photos')
      .upload(storagePath, arrayBuffer, {
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

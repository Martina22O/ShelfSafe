import { createClient } from './supabase/client';
import { isDatabaseError, formatErrorMessage } from './error';

export interface StoreSettings {
  owner_id: string;
  store_name: string | null;
  contact_number: string | null;
  near_expiry_days: number;
  created_at: string | null;
  updated_at: string | null;
}

export type StoreSettingsResult =
  | { kind: 'success'; data: StoreSettings }
  | { kind: 'db_error'; message: string }
  | { kind: 'network_error'; message: string };

interface RawStoreSettingsRow {
  out_owner_id?: string;
  owner_id?: string;
  out_store_name?: string | null;
  store_name?: string | null;
  out_contact_number?: string | null;
  contact_number?: string | null;
  out_near_expiry_days?: number | null;
  near_expiry_days?: number | null;
  out_created_at?: string | null;
  created_at?: string | null;
  out_updated_at?: string | null;
  updated_at?: string | null;
}

function mapRowToStoreSettings(row: RawStoreSettingsRow): StoreSettings {
  return {
    owner_id: String(row.out_owner_id || row.owner_id || ''),
    store_name: row.out_store_name ?? row.store_name ?? null,
    contact_number: row.out_contact_number ?? row.contact_number ?? null,
    near_expiry_days: Number(row.out_near_expiry_days ?? row.near_expiry_days ?? 7),
    created_at: row.out_created_at ?? row.created_at ?? null,
    updated_at: row.out_updated_at ?? row.updated_at ?? null,
  };
}

/**
 * Loads store settings for the signed-in user via get_store_settings RPC.
 */
export async function getStoreSettings(): Promise<StoreSettingsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_store_settings', {});

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: formatErrorMessage(error) };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const rows = (data || []) as RawStoreSettingsRow[];
    const row = Array.isArray(rows) ? rows[0] : (rows as RawStoreSettingsRow);
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: formatErrorMessage(err) };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
    };
  }
}

/**
 * Saves store details (store name and contact number) via save_store_details RPC.
 */
export async function saveStoreDetails(params: {
  storeName: string | null;
  contactNumber: string | null;
}): Promise<StoreSettingsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('save_store_details', {
      p_store_name: params.storeName,
      p_contact_number: params.contactNumber,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: formatErrorMessage(error) };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const rows = (data || []) as RawStoreSettingsRow[];
    const row = Array.isArray(rows) ? rows[0] : (rows as RawStoreSettingsRow);
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: formatErrorMessage(err) };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
    };
  }
}

/**
 * Saves near-expiry threshold days via save_near_expiry_days RPC.
 */
export async function saveNearExpiryDays(
  nearExpiryDays: number
): Promise<StoreSettingsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('save_near_expiry_days', {
      p_near_expiry_days: nearExpiryDays,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: formatErrorMessage(error) };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const rows = (data || []) as RawStoreSettingsRow[];
    const row = Array.isArray(rows) ? rows[0] : (rows as RawStoreSettingsRow);
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: formatErrorMessage(err) };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
    };
  }
}


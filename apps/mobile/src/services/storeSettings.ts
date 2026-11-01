import { supabase } from './supabase';
import { isDatabaseError } from './inventory';

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

function mapRowToStoreSettings(row: any): StoreSettings {
  return {
    owner_id: row.out_owner_id || row.owner_id,
    store_name: row.out_store_name ?? row.store_name ?? null,
    contact_number: row.out_contact_number ?? row.contact_number ?? null,
    near_expiry_days: Number(row.out_near_expiry_days ?? row.near_expiry_days ?? 7),
    created_at: row.out_created_at ?? row.created_at ?? null,
    updated_at: row.out_updated_at ?? row.updated_at ?? null,
  };
}

/**
 * Loads store settings for the signed-in user.
 * Calls get_store_settings() RPC with named arguments.
 */
export async function getStoreSettings(): Promise<StoreSettingsResult> {
  try {
    const { data, error } = await supabase.rpc('get_store_settings', {});

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error occurred' };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Saves store details (store name and contact number).
 * Calls save_store_details(p_store_name, p_contact_number) RPC with named arguments.
 */
export async function saveStoreDetails(params: {
  storeName: string | null;
  contactNumber: string | null;
}): Promise<StoreSettingsResult> {
  try {
    const { data, error } = await supabase.rpc('save_store_details', {
      p_store_name: params.storeName,
      p_contact_number: params.contactNumber,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error occurred' };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Saves near-expiry threshold days.
 * Calls save_near_expiry_days(p_near_expiry_days) RPC with named arguments.
 */
export async function saveNearExpiryDays(
  nearExpiryDays: number
): Promise<StoreSettingsResult> {
  try {
    const { data, error } = await supabase.rpc('save_near_expiry_days', {
      p_near_expiry_days: nearExpiryDays,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: mapRowToStoreSettings(row),
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error occurred' };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}


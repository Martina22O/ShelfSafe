import { supabase } from './supabase';
import {
  Category,
  Product,
  ProductWithBatches,
  AddStockParams,
  CreateProductWithBatchParams,
} from '../types/inventory';
import { getBarcodeVariants } from '../utils/barcode';
import { getTodayInManila } from '../utils/date';

export type FindProductResult =
  | { kind: 'found'; product: Product }
  | { kind: 'archived'; product: Product }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export type SearchProductsResult =
  | { kind: 'success'; products: Product[] }
  | { kind: 'error'; message: string };

export type ProductWithBatchesResult =
  | { kind: 'success'; data: ProductWithBatches }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export type AddStockResult =
  | { kind: 'success'; batchId: string }
  | { kind: 'error'; message: string };

export type CreateProductResult =
  | { kind: 'success'; productId: string; batchId: string }
  | { kind: 'error'; message: string };

/**
 * Fetch all categories from the categories table, ordered by name.
 */
export async function getCategories(): Promise<
  { kind: 'success'; categories: Category[] } | { kind: 'error'; message: string }
> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) {
      return { kind: 'error', message: error.message };
    }

    return { kind: 'success', categories: data || [] };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching categories',
    };
  }
}

/**
 * Find a product by barcode trying all UPC-A / EAN-13 variants.
 * Tells apart found, archived, not_found, and database error.
 */
export async function findProductByBarcode(
  rawBarcode: string
): Promise<FindProductResult> {
  try {
    const variants = getBarcodeVariants(rawBarcode);
    if (variants.length === 0) {
      return { kind: 'not_found' };
    }

    // Query matching any barcode variant (including archived products)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .in('barcode', variants)
      .limit(1);

    if (error) {
      return { kind: 'error', message: error.message };
    }

    if (!data || data.length === 0) {
      return { kind: 'not_found' };
    }

    const item = data[0];
    const product: Product = {
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      price: Number(item.price),
      low_stock_level: item.low_stock_level,
      is_archived: item.is_archived,
      category_id: item.category_id,
      category: item.categories as any,
    };

    if (product.is_archived) {
      return { kind: 'archived', product };
    }

    return { kind: 'found', product };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error finding product by barcode',
    };
  }
}

/**
 * Search active products by name.
 * Escapes % and _ wildcards and limits results to 20.
 */
export async function searchProductsByName(
  query: string
): Promise<SearchProductsResult> {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return { kind: 'success', products: [] };
    }

    // Escape SQL wildcard characters
    const escaped = trimmed.replace(/[%_\\]/g, '\\$&');

    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .ilike('name', `%${escaped}%`)
      .eq('is_archived', false)
      .order('name')
      .limit(20);

    if (error) {
      return { kind: 'error', message: error.message };
    }

    const products: Product[] = (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      price: Number(item.price),
      low_stock_level: item.low_stock_level,
      is_archived: item.is_archived,
      category_id: item.category_id,
      category: item.categories as any,
    }));

    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error searching products',
    };
  }
}

/**
 * Fetch product details along with its active batches.
 * Computes:
 * - total_units: sum of quantity_left of all non-archived batches (including expired)
 * - sellable_units: sum of quantity_left of non-archived non-expired batches
 * - batch_count: number of non-archived batches
 */
export async function getProductWithBatches(
  productId: string
): Promise<ProductWithBatchesResult> {
  try {
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .eq('id', productId)
      .maybeSingle();

    if (prodError) {
      return { kind: 'error', message: prodError.message };
    }

    if (!prodData) {
      return { kind: 'not_found' };
    }

    const { data: batchesData, error: batchesError } = await supabase
      .from('batches')
      .select('id, product_id, quantity_left, purchase_date, expiration_date, is_archived, created_at')
      .eq('product_id', productId)
      .eq('is_archived', false)
      .order('expiration_date', { ascending: true });

    if (batchesError) {
      return { kind: 'error', message: batchesError.message };
    }

    const today = getTodayInManila();
    const batches = batchesData || [];

    let totalUnits = 0;
    let sellableUnits = 0;

    for (const b of batches) {
      totalUnits += b.quantity_left;
      if (b.expiration_date >= today) {
        sellableUnits += b.quantity_left;
      }
    }

    const result: ProductWithBatches = {
      id: prodData.id,
      name: prodData.name,
      barcode: prodData.barcode,
      price: Number(prodData.price),
      low_stock_level: prodData.low_stock_level,
      is_archived: prodData.is_archived,
      category_id: prodData.category_id,
      category: prodData.categories as any,
      batches,
      total_units: totalUnits,
      sellable_units: sellableUnits,
      batch_count: batches.length,
    };

    return { kind: 'success', data: result };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching product batches',
    };
  }
}

/**
 * Adds a new batch to an existing product via add_stock RPC.
 */
export async function addStock(params: AddStockParams): Promise<AddStockResult> {
  try {
    const { data, error } = await supabase.rpc('add_stock', {
      p_product_id: params.p_product_id,
      p_quantity: params.p_quantity,
      p_purchase_date: params.p_purchase_date || null,
      p_expiration_date: params.p_expiration_date,
    });

    if (error) {
      return { kind: 'error', message: error.message };
    }

    return { kind: 'success', batchId: data };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to add stock batch',
    };
  }
}

/**
 * Creates a new product and initial batch atomically via create_product_with_batch RPC.
 */
export async function createProductWithBatch(
  params: CreateProductWithBatchParams
): Promise<CreateProductResult> {
  try {
    const { data, error } = await supabase.rpc('create_product_with_batch', {
      p_name: params.p_name,
      p_category_id: params.p_category_id,
      p_price: params.p_price,
      p_quantity: params.p_quantity,
      p_expiration_date: params.p_expiration_date,
      p_barcode: params.p_barcode || null,
      p_low_stock_level: params.p_low_stock_level ?? 5,
      p_purchase_date: params.p_purchase_date || null,
    });

    if (error) {
      return { kind: 'error', message: error.message };
    }

    // create_product_with_batch returns a table of rows with new_product_id, new_batch_id
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.new_product_id) {
      return {
        kind: 'error',
        message: 'Could not create product. No ID returned.',
      };
    }

    return {
      kind: 'success',
      productId: row.new_product_id,
      batchId: row.new_batch_id,
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to create product with batch',
    };
  }
}

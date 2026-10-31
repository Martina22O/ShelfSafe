import { supabase } from './supabase';
import {
  Category,
  Product,
  Batch,
  ProductWithBatches,
  ProductStockStatus,
  AddStockParams,
  CreateProductWithBatchParams,
  PreviewSaleBatchDeduction,
  SaleHistoryRecord,
  InventoryAlert,
  SalesMetrics,
  MostStockedProduct,
  MostSoldProduct,
  LeastSoldProduct,
  HomeSummaryData,
  UpdateProductParams,
  MutationResult,
  BatchActionResult,
  ProductActionResult,
} from '../types/inventory';
import { getBarcodeVariants } from '../utils/barcode';
import { getTodayInManila, NEAR_EXPIRY_DAYS, addDaysToDate } from '../utils/date';

/**
 * Classifies whether an error is a clear database error or an unclear failure (network / timeout).
 * Matches patterns from PostgreSQL / Supabase constraints and custom RAISE EXCEPTION messages.
 */
export function isDatabaseError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : error.message || '';
  return Boolean(
    error.code ||
      /insufficient|not found|archived|access denied|greater than|equal to|required|authentication|already exists|cannot be|unique/i.test(
        msg
      )
  );
}

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

export type GetInventoryResult =
  | { kind: 'success'; products: ProductWithBatches[] }
  | { kind: 'error'; message: string };

export type AddStockResult =
  | { kind: 'success'; batchId: string }
  | { kind: 'error'; message: string };

export type CreateProductResult =
  | { kind: 'success'; productId: string; batchId: string }
  | { kind: 'error'; message: string };

export type PreviewSaleResult =
  | { kind: 'success'; deductions: PreviewSaleBatchDeduction[] }
  | { kind: 'error'; message: string };

export type RecordSaleResult =
  | { kind: 'success'; salesScanId: string }
  | { kind: 'db_error'; message: string }
  | { kind: 'unknown_error'; message: string };

export type UndoSaleResult =
  | { kind: 'success' }
  | { kind: 'error'; message: string; isAlreadyUndone: boolean };

export type GetSaleHistoryResult =
  | { kind: 'success'; history: SaleHistoryRecord[] }
  | { kind: 'error'; message: string };


/**
 * Computes product-level stock status badges according to product rules:
 * 1. "Has expired stock" if any batch with units left is expired (< today).
 * 2. "Low stock" if sellable_units is at or below the product's low_stock_level.
 * 3. "Near expiry" if any batch with units left expires within 7 days from today (today <= exp <= today + 7).
 * 4. Otherwise "In Stock" (if none of the above badges apply).
 * A product can have more than one badge.
 */
export function computeProductStatuses(
  product: { low_stock_level: number },
  batches: Batch[],
  sellableUnits: number,
  today: string = getTodayInManila()
): ProductStockStatus[] {
  const statuses: ProductStockStatus[] = [];
  const nearExpiryThreshold = addDaysToDate(today, NEAR_EXPIRY_DAYS);

  // 1. "Has expired stock" if any batch with units left is expired
  const hasExpired = batches.some(
    (b) => !b.is_archived && b.quantity_left > 0 && b.expiration_date < today
  );
  if (hasExpired) {
    statuses.push('Has expired stock');
  }

  // 2. "Low stock" if sellable_units is at or below the product's low_stock_level
  if (sellableUnits <= product.low_stock_level) {
    statuses.push('Low stock');
  }

  // 3. "Near expiry" if any batch with units left expires within 7 days from today (not expired yet)
  const hasNearExpiry = batches.some(
    (b) =>
      !b.is_archived &&
      b.quantity_left > 0 &&
      b.expiration_date >= today &&
      b.expiration_date <= nearExpiryThreshold
  );
  if (hasNearExpiry) {
    statuses.push('Near expiry');
  }

  // 4. otherwise "In Stock"
  if (statuses.length === 0) {
    statuses.push('In Stock');
  }

  return statuses;
}

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

    const statuses = computeProductStatuses(
      { low_stock_level: prodData.low_stock_level },
      batches,
      sellableUnits,
      today
    );

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
      statuses,
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
 * Fetch all non-archived products with their category and active batches in a single query.
 * For each product computes total_units, sellable_units, batch_count, and status badges.
 */
export async function getInventory(): Promise<GetInventoryResult> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        barcode,
        price,
        low_stock_level,
        is_archived,
        category_id,
        categories (
          id,
          name
        ),
        batches (
          id,
          product_id,
          quantity_left,
          purchase_date,
          expiration_date,
          is_archived,
          created_at
        )
      `)
      .eq('is_archived', false)
      .eq('batches.is_archived', false)
      .order('name');

    if (error) {
      return {
        kind: 'error',
        message: error.message || 'Database error fetching inventory',
      };
    }

    const today = getTodayInManila();

    const products: ProductWithBatches[] = (data || []).map((item: any) => {
      const batches: Batch[] = (item.batches || [])
        .filter((b: any) => !b.is_archived)
        .map((b: any) => ({
          id: b.id,
          product_id: b.product_id,
          quantity_left: Number(b.quantity_left),
          purchase_date: b.purchase_date,
          expiration_date: b.expiration_date,
          is_archived: b.is_archived,
          created_at: b.created_at,
        }))
        .sort((a: Batch, b: Batch) => a.expiration_date.localeCompare(b.expiration_date));

      let totalUnits = 0;
      let sellableUnits = 0;

      for (const b of batches) {
        totalUnits += b.quantity_left;
        if (b.expiration_date >= today) {
          sellableUnits += b.quantity_left;
        }
      }

      const statuses = computeProductStatuses(
        { low_stock_level: item.low_stock_level ?? 5 },
        batches,
        sellableUnits,
        today
      );

      return {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        price: Number(item.price),
        low_stock_level: item.low_stock_level,
        is_archived: item.is_archived,
        category_id: item.category_id,
        category: item.categories as any,
        batches,
        total_units: totalUnits,
        sellable_units: sellableUnits,
        batch_count: batches.length,
        statuses,
      };
    });

    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching inventory',
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

/**
 * Previews FEFO deduction batches for a given product and quantity.
 * Does not mutate database.
 */
export async function previewSale(
  productId: string,
  quantity: number
): Promise<PreviewSaleResult> {
  try {
    const { data, error } = await supabase.rpc('preview_sale', {
      p_product_id: productId,
      p_quantity: quantity,
    });

    if (error) {
      return {
        kind: 'error',
        message: error.message || 'Failed to preview sale deduction',
      };
    }

    const deductions: PreviewSaleBatchDeduction[] = (data || []).map((row: any) => ({
      batch_id: row.batch_id,
      expiration_date: row.expiration_date,
      quantity_to_deduct: Number(row.quantity_to_deduct),
      batch_quantity_left: Number(row.batch_quantity_left),
      batch_quantity_remaining: Number(row.batch_quantity_remaining),
    }));

    return { kind: 'success', deductions };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error previewing sale',
    };
  }
}

/**
 * Records a sale atomically via record_sale RPC in FEFO order.
 * Distinguishes clear database errors from unclear network/timeout errors.
 */
export async function recordSale(
  productId: string,
  quantity: number
): Promise<RecordSaleResult> {
  try {
    const { data, error } = await supabase.rpc('record_sale', {
      p_product_id: productId,
      p_quantity: quantity,
    });

    if (error) {
      const msg = error.message || '';
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: msg };
      }

      return {
        kind: 'unknown_error',
        message: msg || 'Network timeout or unexpected failure while recording sale',
      };
    }

    return { kind: 'success', salesScanId: data };
  } catch (err: any) {
    return {
      kind: 'unknown_error',
      message: err?.message || 'Network connection lost while recording sale',
    };
  }
}

/**
 * Undoes a sale scan and restores units back into their respective batches.
 */
export async function undoSale(salesScanId: string): Promise<UndoSaleResult> {
  try {
    const { data: _data, error } = await supabase.rpc('undo_sale', {
      p_sales_scan_id: salesScanId,
    });

    if (error) {
      const msg = error.message || 'Failed to undo sale';
      const isAlreadyUndone = /already been undone/i.test(msg);
      return { kind: 'error', message: msg, isAlreadyUndone };
    }

    return { kind: 'success' };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error undoing sale',
      isAlreadyUndone: false,
    };
  }
}

/**
 * Fetches the user's sale history using get_sale_history RPC.
 */
export async function getSaleHistory(
  limit: number = 50
): Promise<GetSaleHistoryResult> {
  try {
    const { data, error } = await supabase.rpc('get_sale_history', {
      p_limit: limit,
    });

    if (error) {
      return {
        kind: 'error',
        message: error.message || 'Database error fetching sale history',
      };
    }

    const history: SaleHistoryRecord[] = (data || []).map((row: any) => ({
      sales_scan_id: row.sales_scan_id,
      created_at: row.created_at,
      is_undone: Boolean(row.is_undone),
      product_id: row.product_id,
      product_name: row.product_name,
      product_barcode: row.product_barcode,
      product_price: Number(row.product_price),
      total_quantity: Number(row.total_quantity),
      batch_breakdown: Array.isArray(row.batch_breakdown) ? row.batch_breakdown : [],
    }));

    return { kind: 'success', history };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching sale history',
    };
  }
}

export type GetInventoryAlertsResult =
  | { kind: 'success'; alerts: InventoryAlert[] }
  | { kind: 'error'; message: string };

/**
 * Fetches all inventory alerts (low stock, near expiry, expired) using get_inventory_alerts RPC.
 * Also retrieves non-archived product prices to attach real prices for estimated value calculations.
 */
export async function getInventoryAlerts(
  daysThreshold: number = NEAR_EXPIRY_DAYS
): Promise<GetInventoryAlertsResult> {
  try {
    const [rpcRes, productsRes] = await Promise.all([
      supabase.rpc('get_inventory_alerts', {
        p_days_threshold: daysThreshold,
      }),
      supabase
        .from('products')
        .select('id, price')
        .eq('is_archived', false),
    ]);

    if (rpcRes.error) {
      return { kind: 'error', message: rpcRes.error.message };
    }

    if (productsRes.error) {
      return { kind: 'error', message: productsRes.error.message };
    }

    const priceMap = new Map<string, number>();
    if (productsRes.data) {
      for (const p of productsRes.data) {
        if (p.price !== null && p.price !== undefined && !isNaN(Number(p.price))) {
          priceMap.set(p.id, Number(p.price));
        }
      }
    }

    const alerts: InventoryAlert[] = (rpcRes.data || []).map((row: any) => {
      const hasPrice = priceMap.has(row.product_id);
      return {
        alert_type: row.alert_type as any,
        product_id: row.product_id,
        product_name: row.product_name,
        category_name: row.category_name,
        barcode: row.barcode,
        low_stock_level: row.low_stock_level !== null ? Number(row.low_stock_level) : null,
        current_stock: row.current_stock !== null ? Number(row.current_stock) : null,
        batch_id: row.batch_id || null,
        expiration_date: row.expiration_date || null,
        batch_quantity_left: row.batch_quantity_left !== null ? Number(row.batch_quantity_left) : null,
        days_until_expiration: row.days_until_expiration !== null ? Number(row.days_until_expiration) : null,
        price: hasPrice ? (priceMap.get(row.product_id) ?? null) : null,
      };
    });

    return { kind: 'success', alerts };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching inventory alerts',
    };
  }
}

export type GetSalesMetricsResult =
  | { kind: 'success'; metrics: SalesMetrics }
  | { kind: 'error'; message: string };

/**
 * Fetches sales metrics (today, this week, this month in Asia/Manila) via get_sales_metrics RPC.
 */
export async function getSalesMetrics(): Promise<GetSalesMetricsResult> {
  try {
    const { data, error } = await supabase.rpc('get_sales_metrics');
    if (error) {
      return { kind: 'error', message: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      metrics: {
        sold_today: Number(row?.sold_today ?? 0),
        sold_this_week: Number(row?.sold_this_week ?? 0),
        sold_this_month: Number(row?.sold_this_month ?? 0),
      },
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch sales metrics',
    };
  }
}

export type GetRankedProductsResult<T> =
  | { kind: 'success'; products: T[] }
  | { kind: 'error'; message: string };

/**
 * Fetches top most-stocked products by non-expired active units via get_most_stocked_products RPC.
 */
export async function getMostStockedProducts(
  limit: number = 5
): Promise<GetRankedProductsResult<MostStockedProduct>> {
  try {
    const { data, error } = await supabase.rpc('get_most_stocked_products', {
      p_limit: limit,
    });
    if (error) {
      return { kind: 'error', message: error.message };
    }
    const products: MostStockedProduct[] = (data || []).map((row: any) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_stock: Number(row.total_stock ?? 0),
    }));
    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch most-stocked products',
    };
  }
}

/**
 * Fetches top most-sold products via get_most_sold_products RPC.
 */
export async function getMostSoldProducts(
  limit: number = 5
): Promise<GetRankedProductsResult<MostSoldProduct>> {
  try {
    const { data, error } = await supabase.rpc('get_most_sold_products', {
      p_limit: limit,
    });
    if (error) {
      return { kind: 'error', message: error.message };
    }
    const products: MostSoldProduct[] = (data || []).map((row: any) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_sold: Number(row.total_sold ?? 0),
    }));
    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch most-sold products',
    };
  }
}

/**
 * Fetches least-sold products via get_least_sold_products RPC.
 */
export async function getLeastSoldProducts(
  limit: number = 5
): Promise<GetRankedProductsResult<LeastSoldProduct>> {
  try {
    const { data, error } = await supabase.rpc('get_least_sold_products', {
      p_limit: limit,
    });
    if (error) {
      return { kind: 'error', message: error.message };
    }
    const products: LeastSoldProduct[] = (data || []).map((row: any) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_sold: Number(row.total_sold ?? 0),
      total_stock: Number(row.total_stock ?? 0),
    }));
    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch least-sold products',
    };
  }
}

export type GetHomeSummaryResult =
  | { kind: 'success'; summary: HomeSummaryData }
  | { kind: 'error'; message: string };

/**
 * Fetches consolidated home summary via get_home_summary RPC.
 */
export async function getHomeSummary(): Promise<GetHomeSummaryResult> {
  try {
    const { data, error } = await supabase.rpc('get_home_summary');
    if (error) {
      return { kind: 'error', message: error.message };
    }
    return { kind: 'success', summary: data as HomeSummaryData };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch home summary',
    };
  }
}

/**
 * Fetches a single batch by ID to ensure freshest data when opening dialogs.
 */
export async function getBatch(
  batchId: string
): Promise<
  | { kind: 'success'; batch: Batch }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }
> {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select('id, product_id, quantity_left, purchase_date, expiration_date, is_archived, created_at')
      .eq('id', batchId)
      .maybeSingle();

    if (error) {
      return { kind: 'error', message: error.message };
    }

    if (!data) {
      return { kind: 'not_found' };
    }

    return {
      kind: 'success',
      batch: {
        id: data.id,
        product_id: data.product_id,
        quantity_left: Number(data.quantity_left),
        purchase_date: data.purchase_date,
        expiration_date: data.expiration_date,
        is_archived: Boolean(data.is_archived),
        created_at: data.created_at,
      },
    };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Failed to fetch batch',
    };
  }
}

/**
 * Corrects batch quantity via correct_batch_quantity RPC.
 */
export async function correctBatchQuantity(
  batchId: string,
  newQuantity: number
): Promise<MutationResult<Batch>> {
  try {
    const { data, error } = await supabase.rpc('correct_batch_quantity', {
      p_batch_id: batchId,
      p_new_quantity: newQuantity,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        product_id: data.product_id,
        quantity_left: Number(data.quantity_left),
        purchase_date: data.purchase_date,
        expiration_date: data.expiration_date,
        is_archived: Boolean(data.is_archived),
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Updates batch dates via update_batch_dates RPC.
 */
export async function updateBatchDates(
  batchId: string,
  purchaseDate: string,
  expirationDate: string
): Promise<MutationResult<Batch>> {
  try {
    const { data, error } = await supabase.rpc('update_batch_dates', {
      p_batch_id: batchId,
      p_purchase_date: purchaseDate,
      p_expiration_date: expirationDate,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        product_id: data.product_id,
        quantity_left: Number(data.quantity_left),
        purchase_date: data.purchase_date,
        expiration_date: data.expiration_date,
        is_archived: Boolean(data.is_archived),
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Updates product details via update_product RPC.
 */
export async function updateProduct(
  params: UpdateProductParams
): Promise<MutationResult<Product>> {
  try {
    const { data, error } = await supabase.rpc('update_product', {
      p_product_id: params.productId,
      p_name: params.name,
      p_barcode: params.barcode ? params.barcode.trim() : null,
      p_category_id: params.categoryId,
      p_price: params.price,
      p_low_stock_level: params.lowStockLevel,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        name: data.name,
        barcode: data.barcode,
        category_id: data.category_id,
        price: Number(data.price),
        low_stock_level: Number(data.low_stock_level),
        is_archived: Boolean(data.is_archived),
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Removes a batch via remove_batch RPC (deletes if unused, archives if used).
 */
export async function removeBatch(
  batchId: string
): Promise<MutationResult<BatchActionResult>> {
  try {
    const { data, error } = await supabase.rpc('remove_batch', {
      p_batch_id: batchId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        productId: data.product_id,
        status: data.status,
        action: data.action,
        quantityLeft: data.quantity_left !== undefined ? Number(data.quantity_left) : undefined,
        purchaseDate: data.purchase_date,
        expirationDate: data.expiration_date,
        isArchived: data.is_archived,
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Removes a product via remove_product RPC (deletes if unused, archives if used).
 */
export async function removeProduct(
  productId: string
): Promise<MutationResult<ProductActionResult>> {
  try {
    const { data, error } = await supabase.rpc('remove_product', {
      p_product_id: productId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        status: data.status,
        action: data.action,
        isArchived: data.is_archived,
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Restores an archived product via restore_product RPC.
 */
export async function restoreProduct(
  productId: string
): Promise<MutationResult<ProductActionResult>> {
  try {
    const { data, error } = await supabase.rpc('restore_product', {
      p_product_id: productId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_timeout',
        message: 'Not sure if this was saved. Pull down to refresh and check',
      };
    }

    return {
      kind: 'success',
      data: {
        id: data.id,
        name: data.name,
        barcode: data.barcode,
        status: data.status,
        action: data.action,
        isArchived: false,
      },
    };
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return { kind: 'db_error', message: err?.message || 'Database error' };
    }
    return {
      kind: 'network_timeout',
      message: 'Not sure if this was saved. Pull down to refresh and check',
    };
  }
}

/**
 * Fetches all archived products for the authenticated user.
 */
export async function getArchivedProducts(): Promise<
  | { kind: 'success'; products: Product[] }
  | { kind: 'error'; message: string }
> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .eq('is_archived', true)
      .order('name');

    if (error) {
      return { kind: 'error', message: error.message };
    }

    const products: Product[] = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      price: Number(item.price),
      low_stock_level: item.low_stock_level,
      is_archived: true,
      category_id: item.category_id,
      category: item.categories as any,
    }));

    return { kind: 'success', products };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Network error fetching archived products',
    };
  }
}



import { createClient } from './supabase/client';
import {
  Category,
  Product,
  Batch,
  ProductWithBatches,
  ProductStockStatus,
  AddStockParams,
  CreateProductWithBatchParams,
  FindProductResult,
  SearchProductsResult,
  ProductWithBatchesResult,
  GetInventoryResult,
  AddStockResult,
  CreateProductResult,
  UpdateProductParams,
  BatchActionResult,
  ProductActionResult,
  MutationResult,
  GetBatchResult,
  GetArchivedProductsResult,
  InventoryAlert,
  InventoryAlertType,
  MostStockedProduct,
  MostSoldProduct,
  LeastSoldProduct,
  GetInventoryAlertsResult,
  GetSalesMetricsResult,
  GetRankedProductsResult,
} from '../types/inventory';
import { getBarcodeVariants } from './barcode';
import { getTodayInManila, addDaysToDate } from './date';
import { isDatabaseError, formatErrorMessage } from './error';

/**
 * Computes product-level stock status badges according to product rules:
 * 1. "Has expired stock" if any batch with units left is expired (< today).
 * 2. "Low stock" if sellable_units is at or below the product's low_stock_level.
 * 3. "Near expiry" if any batch with units left expires within nearExpiryDays from today (today <= exp <= today + nearExpiryDays).
 * 4. Otherwise "In Stock" (if none of the above badges apply).
 * nearExpiryDays is REQUIRED (no default value).
 */
export function computeProductStatuses(
  product: { low_stock_level: number },
  batches: Batch[],
  sellableUnits: number,
  today: string,
  nearExpiryDays: number
): ProductStockStatus[] {
  const statuses: ProductStockStatus[] = [];
  const nearExpiryThreshold = addDaysToDate(today, nearExpiryDays);

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

  // 3. "Near expiry" if any batch with units left expires within threshold from today (not expired yet)
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

export async function getCategories(): Promise<
  { kind: 'success'; categories: Category[] } | { kind: 'error'; message: string }
> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    return { kind: 'success', categories: data || [] };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Fetch all non-archived products with their category and active batches in a single query.
 * For each product computes total_units, sellable_units, batch_count, and status badges.
 */
export async function getInventory(
  nearExpiryDays: number
): Promise<GetInventoryResult> {
  try {
    const supabase = createClient();
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
        message: formatErrorMessage(error),
      };
    }

    const today = getTodayInManila();

    interface RawProduct {
      id: string;
      name: string;
      barcode: string | null;
      price: number | string;
      low_stock_level: number;
      is_archived: boolean;
      category_id: string | null;
      categories: Category | Category[] | null;
      batches: Batch[];
    }

    const products: ProductWithBatches[] = ((data as unknown as RawProduct[]) || []).map((item) => {
      const batches: Batch[] = (item.batches || [])
        .filter((b) => !b.is_archived)
        .map((b) => ({
          id: b.id,
          product_id: b.product_id,
          quantity_left: Number(b.quantity_left),
          purchase_date: b.purchase_date,
          expiration_date: b.expiration_date,
          is_archived: b.is_archived,
          created_at: b.created_at,
        }))
        .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

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
        today,
        nearExpiryDays
      );

      const category = Array.isArray(item.categories)
        ? item.categories[0] ?? null
        : item.categories ?? null;

      return {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        price: Number(item.price),
        low_stock_level: item.low_stock_level,
        is_archived: item.is_archived,
        category_id: item.category_id,
        category,
        batches,
        total_units: totalUnits,
        sellable_units: sellableUnits,
        batch_count: batches.length,
        statuses,
      };
    });

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Fetch product details along with its active batches.
 */
export async function getProductWithBatches(
  productId: string,
  nearExpiryDays: number
): Promise<ProductWithBatchesResult> {
  try {
    const supabase = createClient();
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .eq('id', productId)
      .maybeSingle();

    if (prodError) {
      return { kind: 'error', message: formatErrorMessage(prodError) };
    }

    if (!prodData) {
      return { kind: 'not_found' };
    }

    const category = Array.isArray(prodData.categories)
      ? (prodData.categories[0] as Category) ?? null
      : (prodData.categories as Category) ?? null;

    const productSummary: Product = {
      id: prodData.id,
      name: prodData.name,
      barcode: prodData.barcode,
      price: Number(prodData.price),
      low_stock_level: prodData.low_stock_level,
      is_archived: prodData.is_archived,
      category_id: prodData.category_id,
      category,
    };

    if (prodData.is_archived) {
      return { kind: 'archived', product: productSummary };
    }

    const { data: batchesData, error: batchesError } = await supabase
      .from('batches')
      .select('id, product_id, quantity_left, purchase_date, expiration_date, is_archived, created_at')
      .eq('product_id', productId)
      .eq('is_archived', false)
      .order('expiration_date', { ascending: true });

    if (batchesError) {
      return { kind: 'error', message: formatErrorMessage(batchesError) };
    }

    const today = getTodayInManila();
    const batches = (batchesData || []).map((b) => ({
      id: b.id,
      product_id: b.product_id,
      quantity_left: Number(b.quantity_left),
      purchase_date: b.purchase_date,
      expiration_date: b.expiration_date,
      is_archived: b.is_archived,
      created_at: b.created_at,
    }));

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
      today,
      nearExpiryDays
    );

    const result: ProductWithBatches = {
      ...productSummary,
      batches,
      total_units: totalUnits,
      sellable_units: sellableUnits,
      batch_count: batches.length,
      statuses,
    };

    return { kind: 'success', data: result };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Find a product by barcode trying all UPC-A / EAN-13 variants.
 */
export async function findProductByBarcode(
  rawBarcode: string
): Promise<FindProductResult> {
  try {
    const variants = getBarcodeVariants(rawBarcode);
    if (variants.length === 0) {
      return { kind: 'not_found' };
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .in('barcode', variants)
      .limit(1);

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    if (!data || data.length === 0) {
      return { kind: 'not_found' };
    }

    const item = data[0];
    const category = Array.isArray(item.categories)
      ? (item.categories[0] as Category) ?? null
      : (item.categories as Category) ?? null;

    const product: Product = {
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      price: Number(item.price),
      low_stock_level: item.low_stock_level,
      is_archived: item.is_archived,
      category_id: item.category_id,
      category,
    };

    if (product.is_archived) {
      return { kind: 'archived', product };
    }

    return { kind: 'found', product };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Search active products by name.
 * Escapes SQL wildcard characters (% and _) and limits results to 20.
 */
export async function searchProductsByName(
  query: string
): Promise<SearchProductsResult> {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return { kind: 'success', products: [] };
    }

    const escaped = trimmed.replace(/[%_\\]/g, '\\$&');

    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .ilike('name', `%${escaped}%`)
      .eq('is_archived', false)
      .order('name')
      .limit(20);

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    const products: Product[] = (data || []).map((item) => {
      const category = Array.isArray(item.categories)
        ? (item.categories[0] as Category) ?? null
        : (item.categories as Category) ?? null;

      return {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        price: Number(item.price),
        low_stock_level: item.low_stock_level,
        is_archived: item.is_archived,
        category_id: item.category_id,
        category,
      };
    });

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Adds a new batch to an existing product via add_stock RPC.
 */
export async function addStock(params: AddStockParams): Promise<AddStockResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('add_stock', {
      p_product_id: params.p_product_id,
      p_quantity: params.p_quantity,
      p_purchase_date: params.p_purchase_date || null,
      p_expiration_date: params.p_expiration_date,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    return { kind: 'success', batchId: data };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
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
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.new_product_id) {
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    return {
      kind: 'success',
      productId: row.new_product_id,
      batchId: row.new_batch_id,
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
    };
  }
}

/**
 * Fetches a single batch by ID (used for re-fetching when opening correction dialogs).
 */
export async function getBatch(batchId: string): Promise<GetBatchResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('batches')
      .select('id, product_id, quantity_left, purchase_date, expiration_date, is_archived, created_at')
      .eq('id', batchId)
      .maybeSingle();

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
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
  } catch (err: unknown) {
    return { kind: 'error', message: formatErrorMessage(err) };
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('correct_batch_quantity', {
      p_batch_id: batchId,
      p_new_quantity: newQuantity,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        product_id: row.product_id,
        quantity_left: Number(row.quantity_left),
        purchase_date: row.purchase_date,
        expiration_date: row.expiration_date,
        is_archived: Boolean(row.is_archived),
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
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
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        product_id: row.product_id,
        quantity_left: Number(row.quantity_left),
        purchase_date: row.purchase_date,
        expiration_date: row.expiration_date,
        is_archived: Boolean(row.is_archived),
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
    const trimmedBarcode = params.barcode && params.barcode.trim() !== '' ? params.barcode.trim() : null;
    const { data, error } = await supabase.rpc('update_product', {
      p_product_id: params.productId,
      p_name: params.name.trim(),
      p_barcode: trimmedBarcode,
      p_category_id: params.categoryId,
      p_price: params.price,
      p_low_stock_level: params.lowStockLevel,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        category_id: row.category_id,
        price: Number(row.price),
        low_stock_level: Number(row.low_stock_level),
        is_archived: Boolean(row.is_archived),
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('remove_batch', {
      p_batch_id: batchId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        productId: row.product_id,
        status: row.status,
        action: row.action,
        quantityLeft: row.quantity_left !== undefined ? Number(row.quantity_left) : undefined,
        purchaseDate: row.purchase_date,
        expirationDate: row.expiration_date,
        isArchived: row.is_archived,
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('remove_product', {
      p_product_id: productId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        status: row.status,
        action: row.action,
        isArchived: row.is_archived,
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('restore_product', {
      p_product_id: productId,
    });

    if (error) {
      if (isDatabaseError(error)) {
        return { kind: 'db_error', message: error.message };
      }
      return {
        kind: 'network_error',
        message: 'Not sure if this was saved. Reload the page and check',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      kind: 'success',
      data: {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        status: row.status,
        action: row.action,
        isArchived: false,
      },
    };
  } catch (err: unknown) {
    if (isDatabaseError(err)) {
      return {
        kind: 'db_error',
        message: typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Database error occurred',
      };
    }
    return {
      kind: 'network_error',
      message: 'Not sure if this was saved. Reload the page and check',
    };
  }
}

/**
 * Fetches all archived products for the authenticated user.
 */
export async function getArchivedProducts(): Promise<GetArchivedProductsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, price, low_stock_level, is_archived, category_id, categories(id, name)')
      .eq('is_archived', true)
      .order('name');

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    const products: Product[] = (data || []).map((item) => {
      const category = Array.isArray(item.categories)
        ? (item.categories[0] as Category) ?? null
        : (item.categories as Category) ?? null;

      return {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        price: Number(item.price),
        low_stock_level: item.low_stock_level,
        is_archived: true,
        category_id: item.category_id,
        category,
      };
    });

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Fetches all inventory alerts (low stock, near expiry, expired) using get_inventory_alerts RPC.
 * Attaches prices by product_id after the alerts load in the same loading step.
 */
export async function getInventoryAlerts(
  daysThreshold: number
): Promise<GetInventoryAlertsResult> {
  try {
    const supabase = createClient();
    const { data: alertsData, error: alertsError } = await supabase.rpc('get_inventory_alerts', {
      p_days_threshold: daysThreshold,
    });

    if (alertsError) {
      return { kind: 'error', message: formatErrorMessage(alertsError) };
    }

    const rawAlerts = alertsData || [];
    const productIds: string[] = Array.from(
      new Set(rawAlerts.map((r: { product_id: string }) => r.product_id).filter(Boolean))
    );

    const priceMap = new Map<string, number>();

    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, price')
        .in('id', productIds)
        .eq('is_archived', false);

      if (productsError) {
        return { kind: 'error', message: formatErrorMessage(productsError) };
      }

      if (productsData) {
        for (const p of productsData) {
          if (p.price !== null && p.price !== undefined && !isNaN(Number(p.price))) {
            priceMap.set(p.id, Number(p.price));
          }
        }
      }
    }

    const alerts: InventoryAlert[] = rawAlerts.map((row: {
      alert_type: string;
      product_id: string;
      product_name: string;
      category_name: string | null;
      barcode: string | null;
      low_stock_level: number | null;
      current_stock: number | null;
      batch_id: string | null;
      expiration_date: string | null;
      batch_quantity_left: number | null;
      days_until_expiration: number | null;
    }) => {
      const hasPrice = priceMap.has(row.product_id);
      return {
        alert_type: row.alert_type as InventoryAlertType,
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
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Fetches sales metrics (today, this week, this month in Asia/Manila) via get_sales_metrics RPC.
 */
export async function getSalesMetrics(): Promise<GetSalesMetricsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_sales_metrics', {});

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
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
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

/**
 * Fetches top most-stocked products by non-expired active units via get_most_stocked_products RPC.
 */
export async function getMostStockedProducts(
  limit: number = 5
): Promise<GetRankedProductsResult<MostStockedProduct>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_most_stocked_products', {
      p_limit: limit,
    });

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    const products: MostStockedProduct[] = (data || []).map((row: {
      product_id: string;
      product_name: string;
      category_name: string | null;
      barcode: string | null;
      total_stock: number;
    }) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_stock: Number(row.total_stock ?? 0),
    }));

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_most_sold_products', {
      p_limit: limit,
    });

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    const products: MostSoldProduct[] = (data || []).map((row: {
      product_id: string;
      product_name: string;
      category_name: string | null;
      barcode: string | null;
      total_sold: number;
    }) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_sold: Number(row.total_sold ?? 0),
    }));

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
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
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_least_sold_products', {
      p_limit: limit,
    });

    if (error) {
      return { kind: 'error', message: formatErrorMessage(error) };
    }

    const products: LeastSoldProduct[] = (data || []).map((row: {
      product_id: string;
      product_name: string;
      category_name: string | null;
      barcode: string | null;
      total_sold: number;
      total_stock: number;
    }) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      barcode: row.barcode,
      total_sold: Number(row.total_sold ?? 0),
      total_stock: Number(row.total_stock ?? 0),
    }));

    return { kind: 'success', products };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: formatErrorMessage(err),
    };
  }
}

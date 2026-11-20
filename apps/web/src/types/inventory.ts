export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export interface Product {
  id: string;
  owner_id?: string;
  category_id: string | null;
  name: string;
  barcode: string | null;
  price: number;
  low_stock_level: number;
  is_archived: boolean;
  created_at?: string;
  category?: Category | null;
  image_url?: string | null;
}

export interface Batch {
  id: string;
  product_id: string;
  quantity_left: number;
  purchase_date: string;
  expiration_date: string;
  is_archived: boolean;
  created_at?: string;
}

export type ProductStockStatus =
  | 'Has expired stock'
  | 'Low stock'
  | 'Near expiry'
  | 'In Stock';

export type BatchStockStatus =
  | 'Sold out'
  | 'Expired'
  | 'Near Expiry'
  | 'Good';

export interface ProductWithBatches extends Product {
  batches: Batch[];
  total_units: number;
  sellable_units: number;
  batch_count: number;
  statuses: ProductStockStatus[];
}

export interface AddStockParams {
  p_product_id: string;
  p_quantity: number;
  p_purchase_date?: string | null;
  p_expiration_date: string;
}

export interface CreateProductWithBatchParams {
  p_name: string;
  p_category_id: string;
  p_price: number;
  p_quantity: number;
  p_expiration_date: string;
  p_barcode?: string | null;
  p_low_stock_level?: number;
  p_purchase_date?: string | null;
  p_image_url?: string | null;
}

export interface CreateProductWithBatchResult {
  new_product_id: string;
  new_batch_id: string;
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
  | { kind: 'archived'; product: Product }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export type GetInventoryResult =
  | { kind: 'success'; products: ProductWithBatches[] }
  | { kind: 'error'; message: string };

export type AddStockResult =
  | { kind: 'success'; batchId: string }
  | { kind: 'db_error'; message: string }
  | { kind: 'network_error'; message: string };

export type CreateProductResult =
  | { kind: 'success'; productId: string; batchId: string }
  | { kind: 'db_error'; message: string }
  | { kind: 'network_error'; message: string };

export interface UpdateProductParams {
  productId: string;
  name: string;
  barcode: string | null;
  categoryId: string;
  price: number;
  lowStockLevel: number;
}

export interface BatchActionResult {
  id: string;
  productId?: string;
  status: 'deleted' | 'archived';
  action: string;
  quantityLeft?: number;
  purchaseDate?: string;
  expirationDate?: string;
  isArchived?: boolean;
}

export interface ProductActionResult {
  id: string;
  name?: string;
  barcode?: string | null;
  status: 'deleted' | 'archived' | 'restored';
  action: string;
  isArchived?: boolean;
}

export type MutationResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'db_error'; message: string }
  | { kind: 'network_error'; message: string };

export type GetBatchResult =
  | { kind: 'success'; batch: Batch }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export type GetArchivedProductsResult =
  | { kind: 'success'; products: Product[] }
  | { kind: 'error'; message: string };

export type InventoryAlertType = 'low_stock' | 'near_expiry' | 'expired';

export interface InventoryAlert {
  alert_type: InventoryAlertType;
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
  price?: number | null;
}

export interface SalesMetrics {
  sold_today: number;
  sold_this_week: number;
  sold_this_month: number;
}

export interface MostStockedProduct {
  product_id: string;
  product_name: string;
  category_name: string | null;
  barcode: string | null;
  total_stock: number;
}

export interface MostSoldProduct {
  product_id: string;
  product_name: string;
  category_name: string | null;
  barcode: string | null;
  total_sold: number;
}

export interface LeastSoldProduct {
  product_id: string;
  product_name: string;
  category_name: string | null;
  barcode: string | null;
  total_sold: number;
  total_stock: number;
}

export type GetInventoryAlertsResult =
  | { kind: 'success'; alerts: InventoryAlert[] }
  | { kind: 'error'; message: string };

export type GetSalesMetricsResult =
  | { kind: 'success'; metrics: SalesMetrics }
  | { kind: 'error'; message: string };

export type GetRankedProductsResult<T> =
  | { kind: 'success'; products: T[] }
  | { kind: 'error'; message: string };



export interface SaleBatchBreakdownItem {
  batch_id: string;
  quantity: number;
  purchase_date: string;
  expiration_date: string;
}

export interface SaleHistoryRecord {
  sales_scan_id: string;
  created_at: string;
  is_undone: boolean;
  product_id: string;
  product_name: string;
  product_barcode: string | null;
  product_price: number;
  total_quantity: number;
  batch_breakdown: SaleBatchBreakdownItem[];
}

export type UndoSaleResult =
  | { kind: 'success'; hadArchivedItems: boolean }
  | { kind: 'error'; message: string; isAlreadyUndone: boolean; isDatabaseError: boolean };

export type GetSaleHistoryResult =
  | { kind: 'success'; history: SaleHistoryRecord[] }
  | { kind: 'error'; message: string };

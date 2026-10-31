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
}

export interface CreateProductWithBatchResult {
  new_product_id: string;
  new_batch_id: string;
}

export interface SaleCartItem {
  productId: string;
  name: string;
  barcode: string | null;
  price: number;
  sellableUnits: number;
  quantity: number;
}

export interface PreviewSaleBatchDeduction {
  batch_id: string;
  expiration_date: string;
  quantity_to_deduct: number;
  batch_quantity_left: number;
  batch_quantity_remaining: number;
}

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

export interface HomeSummaryData {
  metrics: SalesMetrics;
  most_stocked: MostStockedProduct[];
  most_sold: MostSoldProduct[];
  least_sold: LeastSoldProduct[];
  alert_counts: {
    low_stock: number;
    near_expiry: number;
    expired: number;
  };
}

export interface UpdateProductParams {
  productId: string;
  name: string;
  barcode: string | null;
  categoryId: string;
  price: number;
  lowStockLevel: number;
}

export type MutationResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'db_error'; message: string }
  | { kind: 'network_timeout'; message: string };

export interface BatchActionResult {
  id: string;
  productId: string;
  status: 'deleted' | 'archived';
  action: 'deleted' | 'archived';
  quantityLeft?: number;
  purchaseDate?: string;
  expirationDate?: string;
  isArchived?: boolean;
}

export interface ProductActionResult {
  id: string;
  status: 'deleted' | 'archived' | 'restored';
  action: 'deleted' | 'archived' | 'restore';
  isArchived?: boolean;
  name?: string;
  barcode?: string | null;
}


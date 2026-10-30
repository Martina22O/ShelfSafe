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

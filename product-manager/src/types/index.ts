export interface Product {
  id: string;
  shopifyId: string;
  shopDomain: string;
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  price?: number;
  inventoryQuantity?: number;
  status: ProductStatus;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface CreateProductInput {
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  price: number;
  inventoryQuantity: number;
  status: ProductStatus;
}

export interface UpdateProductInput {
  title?: string;
  handle?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  price?: number;
  inventoryQuantity?: number;
  status?: ProductStatus;
}

export interface ProductFilters {
  status?: ProductStatus;
  search?: string;
}

export interface ProductConnection {
  items: Product[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}

export interface ProductStats {
  total: number;
  byStatus: {
    active: number;
    draft: number;
    archived: number;
  };
}

export interface DynamoDBProduct {
  shop_domain: string;
  product_id: string;
  shopify_id: string;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  price?: number;
  inventory_quantity?: number;
  status: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}


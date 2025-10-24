export interface Order {
  id: string;
  shopifyId: string;
  shopDomain: string;
  orderNumber: string;
  customerId?: string;
  customerEmail?: string;
  totalPrice: number;
  currency: string;
  status: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface CreateOrderInput {
  customerId?: string;
  customerEmail: string;
  totalPrice: number;
  currency: string;
  status: string;
}

export interface UpdateOrderInput {
  status?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
}

export interface OrderFilters {
  status?: string;
  customerEmail?: string;
  orderNumber?: string;
}

export interface OrderConnection {
  items: Order[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}

export interface OrderStats {
  total: number;
  totalRevenue: number;
  byStatus: {
    pending: number;
    paid: number;
    fulfilled: number;
    cancelled: number;
  };
}

export interface DynamoDBOrder {
  shop_domain: string;
  order_id: string;
  shopify_id: string;
  order_number: string;
  customer_id?: string;
  customer_email?: string;
  total_price: number;
  currency: string;
  status: string;
  fulfillment_status?: string;
  financial_status?: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}


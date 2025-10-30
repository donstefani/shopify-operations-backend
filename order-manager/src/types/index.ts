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
  shop_order_id: string; // Primary key
  shop_domain: string;
  shopify_order_id: string; // Shopify order ID (from event-manager)
  shopify_id?: string; // Alternative field name
  order_name: string; // Order name like "#1001" (from event-manager)
  order_number?: string; // Alternative field name
  order_id?: string; // Alternative field name
  customer_id?: string;
  customer_email?: string;
  email?: string; // Alternative field name (from event-manager)
  total_price: number | string; // Can be string from event-manager
  currency: string;
  status?: string;
  fulfillment_status?: string;
  financial_status: string; // From event-manager
  sync_status?: string;
  created_at: string;
  updated_at: string;
}


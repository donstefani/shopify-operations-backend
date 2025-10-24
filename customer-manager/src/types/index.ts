export interface Customer {
  id: string;
  shopifyId: string;
  shopDomain: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  totalSpent: number;
  ordersCount: number;
  state: CustomerState;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export enum CustomerState {
  DISABLED = 'DISABLED',
  INVITED = 'INVITED',
  ENABLED = 'ENABLED',
  DECLINED = 'DECLINED',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface CreateCustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  state?: CustomerState;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  state?: CustomerState;
}

export interface CustomerFilters {
  state?: CustomerState;
  search?: string;
}

export interface CustomerConnection {
  items: Customer[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}

export interface CustomerStats {
  total: number;
  totalLifetimeValue: number;
  averageOrderValue: number;
  byState: {
    enabled: number;
    disabled: number;
    invited: number;
    declined: number;
  };
}

export interface DynamoDBCustomer {
  shop_domain: string;
  customer_id: string;
  shopify_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  total_spent: number;
  orders_count: number;
  state: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}


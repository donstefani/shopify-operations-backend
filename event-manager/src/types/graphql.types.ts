/**
 * GraphQL Types for Shopify Event Processor
 * 
 * Type definitions for GraphQL operations and responses
 */

import type { RateLimitInfo } from './errors.types';

// GraphQL Response wrapper (moved to errors.types.ts)

export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: Array<string | number>;
  extensions?: {
    code?: string;
    field?: string;
  };
}

// Webhook GraphQL Types
export interface GraphQLWebhook {
  id: string; // GraphQL ID format: gid://shopify/WebhookSubscription/123
  callbackUrl: string;
  format: 'JSON' | 'XML';
  topic: string;
  createdAt: string;
  updatedAt: string;
  apiVersion?: string;
  includeFields?: string[];
  metafieldNamespaces?: string[];
  privateMetafieldNamespaces?: string[];
}

export interface GraphQLWebhookEdge {
  node: GraphQLWebhook;
  cursor: string;
}

export interface GraphQLWebhookConnection {
  edges: GraphQLWebhookEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

// Webhook Input Types
export interface WebhookSubscriptionInput {
  topic: string;
  webhookSubscription: {
    callbackUrl: string;
    format?: 'JSON' | 'XML';
    includeFields?: string[];
    metafieldNamespaces?: string[];
    privateMetafieldNamespaces?: string[];
  };
}

export interface WebhookSubscriptionUpdateInput {
  id: string;
  webhookSubscription: {
    callbackUrl?: string;
    format?: 'JSON' | 'XML';
    includeFields?: string[];
    metafieldNamespaces?: string[];
    privateMetafieldNamespaces?: string[];
  };
}

// Rate Limiting Types (moved to errors.types.ts to avoid duplication)

// GraphQL Client Configuration (moved to errors.types.ts)

// Webhook Management Response Types
export interface WebhookManagementResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  rateLimitInfo?: RateLimitInfo;
}

// Common Webhook Topics (GraphQL format)
export const GRAPHQL_WEBHOOK_TOPICS = {
  // Product events
  PRODUCTS_CREATE: 'PRODUCTS_CREATE',
  PRODUCTS_UPDATE: 'PRODUCTS_UPDATE',
  PRODUCTS_DELETE: 'PRODUCTS_DELETE',
  
  // Order events
  ORDERS_CREATE: 'ORDERS_CREATE',
  ORDERS_UPDATED: 'ORDERS_UPDATED',
  ORDERS_PAID: 'ORDERS_PAID',
  ORDERS_CANCELLED: 'ORDERS_CANCELLED',
  ORDERS_FULFILLED: 'ORDERS_FULFILLED',
  
  // Customer events
  CUSTOMERS_CREATE: 'CUSTOMERS_CREATE',
  CUSTOMERS_UPDATE: 'CUSTOMERS_UPDATE',
  
  // App events
  APP_UNINSTALLED: 'APP_UNINSTALLED'
} as const;

export type GraphQLWebhookTopic = typeof GRAPHQL_WEBHOOK_TOPICS[keyof typeof GRAPHQL_WEBHOOK_TOPICS];

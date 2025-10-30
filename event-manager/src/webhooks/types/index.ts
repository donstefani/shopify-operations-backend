import { z } from 'zod';
import { Request } from 'express';

/**
 * Webhook Types and Schemas
 */

// Extended Request interface for webhook processing
export interface WebhookRequest extends Request {
  rawBody?: string;
  webhookTopic?: string;
  webhookShop?: string;
  webhookId?: string | undefined;
}

// Webhook Topics
export const WEBHOOK_TOPICS = {
  // Product events
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  PRODUCTS_DELETE: 'products/delete',
  
  // Order events
  ORDERS_CREATE: 'orders/create',
  ORDERS_UPDATED: 'orders/updated',
  ORDERS_PAID: 'orders/paid',
  ORDERS_CANCELLED: 'orders/cancelled',
  ORDERS_FULFILLED: 'orders/fulfilled',
  
  // Customer events
  CUSTOMERS_CREATE: 'customers/create',
  CUSTOMERS_UPDATE: 'customers/update',
  
  // App events
  APP_UNINSTALLED: 'app/uninstalled'
} as const;

// Webhook Event Schema
export const WebhookEventSchema = z.object({
  id: z.number().int().positive().optional(),
  topic: z.string(),
  shop_id: z.number().int().positive().optional(),
  shop_domain: z.string().optional(),
  created_at: z.coerce.date().optional(),
  api_version: z.string().optional(),
  data: z.record(z.string(), z.any()) // The actual webhook payload
});

// HMAC Verification Schema
export const HMACVerificationSchema = z.object({
  hmac: z.string().min(1, 'HMAC signature is required'),
  shop: z.string().min(1, 'Shop domain is required'),
  timestamp: z.string().min(1, 'Timestamp is required'),
  body: z.string().min(1, 'Request body is required')
});

// Type exports
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type HMACVerification = z.infer<typeof HMACVerificationSchema>;
export type WebhookTopic = typeof WEBHOOK_TOPICS[keyof typeof WEBHOOK_TOPICS];

// Error types
export interface WebhookError {
  error: string;
  message: string;
  topic?: string;
  shop?: string;
}

// Webhook Handler Result
export interface WebhookHandlerResult {
  success: boolean;
  message: string;
  data?: any;
}

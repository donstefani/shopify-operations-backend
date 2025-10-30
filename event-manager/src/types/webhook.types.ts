/**
 * Webhook Types
 * 
 * Type definitions for webhook registration, management, and API responses.
 * These types are used by the webhook service and related components.
 */

export interface WebhookRegistration {
  topic: string;
  address: string;
  format?: 'json' | 'xml';
  fields?: string[];
  metafield_namespaces?: string[];
  private_metafield_namespaces?: string[];
}

export interface ShopifyWebhook {
  id: number;
  address: string;
  topic: string;
  format: 'json' | 'xml';
  created_at: string;
  updated_at: string;
  fields?: string[];
  metafield_namespaces?: string[];
  private_metafield_namespaces?: string[];
  api_version?: string;
}

export interface WebhookApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

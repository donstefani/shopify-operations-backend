import { z } from 'zod';

/**
 * Simplified Auth Types
 * 
 * Clean, focused type definitions for OAuth functionality
 */

// OAuth Configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  apiVersion: string;
}

// Shopify Token Response
export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
}

// OAuth API Response
export interface OAuthApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Session Interface
export interface AuthSession {
  oauthState?: string;
  shopDomain?: string;
  isAuthenticated?: boolean;
  accessToken?: string;
  scopes?: string;
}

// Validation Schemas
export const OAuthRequestSchema = z.object({
  shop: z.string().min(1, 'Shop domain is required')
});

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  shop: z.string().min(1, 'Shop domain is required')
});

// Type exports
export type OAuthRequest = z.infer<typeof OAuthRequestSchema>;
export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;

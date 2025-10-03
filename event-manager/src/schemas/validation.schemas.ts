/**
 * Validation Schemas for Shopify Event Processor
 * 
 * Zod schemas for runtime validation across the application.
 * This file contains schemas for error handling, GraphQL operations,
 * and other validation needs.
 */

import { z } from 'zod';

// Error Context Validation Schema
export const ErrorContextSchema = z.object({
  service: z.string().optional(),
  operation: z.string().optional(),
  shopDomain: z.string().optional(),
  webhookTopic: z.string().optional(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  additionalData: z.record(z.string(), z.any()).optional()
});

// Error Notification Configuration Schema
export const ErrorNotificationConfigSchema = z.object({
  email: z.object({
    enabled: z.boolean(),
    from: z.string().email(),
    to: z.array(z.string().email()),
    smtp: z.object({
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      auth: z.object({
        user: z.string(),
        pass: z.string()
      })
    })
  }),
  severityThreshold: z.enum(['low', 'medium', 'high', 'critical']),
  rateLimit: z.object({
    enabled: z.boolean(),
    maxEmailsPerHour: z.number().int().min(1),
    maxEmailsPerDay: z.number().int().min(1)
  })
});

// GraphQL Webhook Input Schema
export const WebhookSubscriptionInputSchema = z.object({
  topic: z.string().min(1),
  webhookSubscription: z.object({
    callbackUrl: z.string().url(),
    format: z.enum(['JSON', 'XML']).optional(),
    includeFields: z.array(z.string()).optional(),
    metafieldNamespaces: z.array(z.string()).optional(),
    privateMetafieldNamespaces: z.array(z.string()).optional()
  })
});

// GraphQL Webhook Update Input Schema
export const WebhookSubscriptionUpdateInputSchema = z.object({
  id: z.string().min(1),
  webhookSubscription: z.object({
    callbackUrl: z.string().url().optional(),
    format: z.enum(['JSON', 'XML']).optional(),
    includeFields: z.array(z.string()).optional(),
    metafieldNamespaces: z.array(z.string()).optional(),
    privateMetafieldNamespaces: z.array(z.string()).optional()
  })
});

// GraphQL Client Configuration Schema (moved to avoid duplication)

// Rate Limit Information Schema
export const RateLimitInfoSchema = z.object({
  requestedQueryCost: z.number().int().min(0),
  actualQueryCost: z.number().int().min(0),
  throttleStatus: z.object({
    maximumAvailable: z.number().int().min(0),
    currentlyAvailable: z.number().int().min(0),
    restoreRate: z.number().int().min(0)
  })
});

// Throttle Status Schema
export const ThrottleStatusSchema = z.object({
  maximumAvailable: z.number().int().min(0),
  currentlyAvailable: z.number().int().min(0),
  restoreRate: z.number().int().min(0)
});

// Retry Configuration Schema
export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  baseDelay: z.number().int().min(100),
  maxDelay: z.number().int().min(1000),
  backoffMultiplier: z.number().min(1).max(5),
  retryableStatusCodes: z.array(z.number().int())
});

// Webhook Management Response Schema
export const WebhookManagementResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  rateLimitInfo: RateLimitInfoSchema.optional()
});

// Generic API Response Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional()
});

// Throttling Configuration Schema
export const ThrottlingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(3),
  baseDelay: z.number().int().min(100).default(1000),
  maxDelay: z.number().int().min(1000).default(30000),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  jitter: z.boolean().default(true),
  retryableStatusCodes: z.array(z.number().int()).default([429, 500, 502, 503, 504]),
  respectShopifyRateLimits: z.boolean().default(true)
});

// Throttling Context Schema
export const ThrottlingContextSchema = z.object({
  shopDomain: z.string().min(1),
  operation: z.string().min(1),
  requestId: z.string().optional(),
  additionalData: z.record(z.string(), z.any()).optional()
});

// Rate Limit Info Schema (already defined above)

// Throttling Result Schema
export const ThrottlingResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  rateLimitInfo: RateLimitInfoSchema.optional(),
  retryCount: z.number().int().min(0),
  totalDelay: z.number().int().min(0)
});

// Environment Configuration Schema
export const EnvironmentConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'serverless']).optional(),
  SHOPIFY_CLIENT_ID: z.string().min(1).optional(),
  SHOPIFY_CLIENT_SECRET: z.string().min(1).optional(),
  SHOPIFY_API_VERSION: z.string().min(1).optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1).optional(),
  AWS_DYNAMODB_TABLE: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  ERROR_EMAIL_FROM: z.string().email().optional(),
  ERROR_EMAIL_TO: z.string().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional()
});

// Type exports for convenience
export type ErrorContextType = z.infer<typeof ErrorContextSchema>;
export type ErrorNotificationConfigType = z.infer<typeof ErrorNotificationConfigSchema>;
export type WebhookSubscriptionInputType = z.infer<typeof WebhookSubscriptionInputSchema>;
export type WebhookSubscriptionUpdateInputType = z.infer<typeof WebhookSubscriptionUpdateInputSchema>;
export type RateLimitInfoType = z.infer<typeof RateLimitInfoSchema>;
export type ThrottleStatusType = z.infer<typeof ThrottleStatusSchema>;
export type RetryConfigType = z.infer<typeof RetryConfigSchema>;
export type WebhookManagementResponseType = z.infer<typeof WebhookManagementResponseSchema>;
export type ApiResponseType = z.infer<typeof ApiResponseSchema>;
export type EnvironmentConfigType = z.infer<typeof EnvironmentConfigSchema>;

// GraphQL Request Schema
export const GraphQLRequestSchema = z.object({
  query: z.string().min(1),
  variables: z.record(z.string(), z.any()).optional(),
  operationName: z.string().optional()
});

// GraphQL Response Schema
export const GraphQLResponseSchema = z.object({
  data: z.any().optional(),
  errors: z.array(z.object({
    message: z.string(),
    locations: z.array(z.object({
      line: z.number(),
      column: z.number()
    })).optional(),
    path: z.array(z.union([z.string(), z.number()])).optional(),
    extensions: z.record(z.string(), z.any()).optional()
  })).optional(),
  extensions: z.object({
    cost: z.object({
      requestedQueryCost: z.number(),
      actualQueryCost: z.number(),
      throttleStatus: z.object({
        maximumAvailable: z.number(),
        currentlyAvailable: z.number(),
        restoreRate: z.number()
      })
    }).optional()
  }).optional()
});

// GraphQL Client Config Schema
export const GraphQLClientConfigSchema = z.object({
  shopDomain: z.string().min(1),
  accessToken: z.string().min(1),
  apiVersion: z.string().optional(),
  timeout: z.number().int().min(1000).optional()
});

// GraphQL Client Context Schema
export const GraphQLClientContextSchema = z.object({
  shopDomain: z.string().min(1),
  operation: z.string().min(1),
  requestId: z.string().optional(),
  additionalData: z.record(z.string(), z.any()).optional()
});

// Throttling type exports
export type ThrottlingConfigType = z.infer<typeof ThrottlingConfigSchema>;
export type ThrottlingContextType = z.infer<typeof ThrottlingContextSchema>;
export type ThrottlingResultType = z.infer<typeof ThrottlingResultSchema>;

// GraphQL type exports
export type GraphQLRequestType = z.infer<typeof GraphQLRequestSchema>;
export type GraphQLResponseType = z.infer<typeof GraphQLResponseSchema>;
export type GraphQLClientConfigType = z.infer<typeof GraphQLClientConfigSchema>;
export type GraphQLClientContextType = z.infer<typeof GraphQLClientContextSchema>;

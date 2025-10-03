import { TokenService } from './token.service.js';
import { BaseGraphQLClient } from './core/graphql-client.service.js';
import { GraphQLRequest, GraphQLClientContext } from '../types/errors.types.js';
import { WebhookRegistration, ShopifyWebhook, WebhookApiResponse } from '../types/webhook.types.js';

/**
 * Webhook Service for Event Processor
 * 
 * Handles webhook registration and management using tokens from auth-service
 */


export class WebhookService {
  private readonly tokenService: TokenService;
  private readonly graphqlClient: BaseGraphQLClient;
  private readonly apiVersion: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    this.tokenService = new TokenService();
    this.graphqlClient = new BaseGraphQLClient();
    this.apiVersion = process.env['SHOPIFY_API_VERSION'] || '2024-01';
    this.clientId = process.env['SHOPIFY_CLIENT_ID'] || '';
    this.clientSecret = process.env['SHOPIFY_CLIENT_SECRET'] || '';
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET not set! Webhook registration may fail.');
    }
  }

  /**
   * Register a webhook with Shopify using GraphQL
   */
  async registerWebhookGraphQL(
    shopDomain: string, 
    webhookData: WebhookRegistration
  ): Promise<WebhookApiResponse<ShopifyWebhook>> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        return {
          success: false,
          error: 'No access token found',
          message: `No valid access token found for shop: ${shopDomain}. Please reinstall the app.`
        };
      }

      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              callbackUrl
              topic
              format
              apiVersion
              createdAt
              updatedAt
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const request: GraphQLRequest = {
        query: mutation,
        variables: {
          topic: webhookData.topic.toUpperCase().replace('/', '_'),
          webhookSubscription: {
            callbackUrl: webhookData.address,
            format: webhookData.format?.toUpperCase() || 'JSON',
            apiVersion: this.apiVersion,
            includeFields: webhookData.fields,
            metafieldNamespaces: webhookData.metafield_namespaces,
            privateMetafieldNamespaces: webhookData.private_metafield_namespaces
          }
        }
      };

      const context: GraphQLClientContext = {
        shopDomain,
        operation: 'registerWebhook',
        additionalData: { topic: webhookData.topic }
      };

      const config = {
        shopDomain,
        accessToken: tokenData.accessToken,
        apiVersion: this.apiVersion
      };

      const result = await this.graphqlClient.executeMutation(request, context, config);

      if (!result.success) {
        return {
          success: false,
          error: 'GraphQL mutation failed',
          message: result.error?.message || 'Failed to register webhook via GraphQL'
        };
      }

      const response = result.data;
      if (response?.errors && response.errors.length > 0) {
        return {
          success: false,
          error: 'GraphQL errors',
          message: response.errors.map(e => e.message).join(', ')
        };
      }

      const webhookSubscription = (response?.data as any)?.webhookSubscriptionCreate?.webhookSubscription;
      if (!webhookSubscription) {
        return {
          success: false,
          error: 'Invalid response',
          message: 'No webhook subscription data returned'
        };
      }

      // Convert GraphQL response to REST format for compatibility
      const shopifyWebhook: ShopifyWebhook = {
        id: parseInt(webhookSubscription.id.replace('gid://shopify/WebhookSubscription/', '')),
        address: webhookSubscription.callbackUrl,
        topic: webhookSubscription.topic.toLowerCase().replace('_', '/'),
        format: webhookSubscription.format.toLowerCase() as 'json' | 'xml',
        created_at: webhookSubscription.createdAt,
        updated_at: webhookSubscription.updatedAt,
        api_version: webhookSubscription.apiVersion
      };

      return {
        success: true,
        data: shopifyWebhook,
        message: 'Webhook registered successfully via GraphQL'
      };
    } catch (error) {
      console.error('GraphQL webhook registration error:', error);
      return {
        success: false,
        error: 'Internal server error',
        message: 'Failed to register webhook via GraphQL'
      };
    }
  }

  /**
   * Register a webhook with Shopify using stored access token (REST fallback)
   */
  async registerWebhook(
    shopDomain: string, 
    webhookData: WebhookRegistration
  ): Promise<WebhookApiResponse<ShopifyWebhook>> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        return {
          success: false,
          error: 'No access token found',
          message: `No valid access token found for shop: ${shopDomain}. Please reinstall the app.`
        };
      }

      const url = `https://${shopDomain}/admin/api/${this.apiVersion}/webhooks.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': tokenData.accessToken
        },
        body: JSON.stringify({ webhook: webhookData })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: 'Webhook registration failed',
          message: `Failed to register webhook: ${response.status} ${response.statusText}`,
          data: errorData as any
        };
      }

      const result = await response.json() as { webhook: ShopifyWebhook };
      return {
        success: true,
        data: result.webhook,
        message: 'Webhook registered successfully'
      };
    } catch (error) {
      console.error('Webhook registration error:', error);
      return {
        success: false,
        error: 'Internal server error',
        message: 'Failed to register webhook'
      };
    }
  }

  /**
   * List all webhooks for a shop
   */
  async listWebhooks(shopDomain: string): Promise<WebhookApiResponse<ShopifyWebhook[]>> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        return {
          success: false,
          error: 'No access token found',
          message: `No valid access token found for shop: ${shopDomain}. Please reinstall the app.`
        };
      }

      const url = `https://${shopDomain}/admin/api/${this.apiVersion}/webhooks.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': tokenData.accessToken
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: 'Failed to list webhooks',
          message: `Failed to list webhooks: ${response.status} ${response.statusText}`,
          data: errorData as any
        };
      }

      const result = await response.json() as { webhooks: ShopifyWebhook[] };
      return {
        success: true,
        data: result.webhooks,
        message: 'Webhooks retrieved successfully'
      };
    } catch (error) {
      console.error('Webhook listing error:', error);
      return {
        success: false,
        error: 'Internal server error',
        message: 'Failed to list webhooks'
      };
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(shopDomain: string, webhookId: number): Promise<WebhookApiResponse<never>> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        return {
          success: false,
          error: 'No access token found',
          message: `No valid access token found for shop: ${shopDomain}. Please reinstall the app.`
        };
      }

      const url = `https://${shopDomain}/admin/api/${this.apiVersion}/webhooks/${webhookId}.json`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': tokenData.accessToken
        }
      });

      if (!response.ok) {
        await response.json().catch(() => ({}));
        return {
          success: false,
          error: 'Failed to delete webhook',
          message: `Failed to delete webhook: ${response.status} ${response.statusText}`
        } as WebhookApiResponse<never>;
      }

      return {
        success: true,
        message: 'Webhook deleted successfully'
      } as WebhookApiResponse<never>;
    } catch (error) {
      console.error('Webhook deletion error:', error);
      return {
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete webhook'
      };
    }
  }

  /**
   * Get a specific webhook
   */
  async getWebhook(shopDomain: string, webhookId: number): Promise<WebhookApiResponse<ShopifyWebhook>> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        return {
          success: false,
          error: 'No access token found',
          message: `No valid access token found for shop: ${shopDomain}. Please reinstall the app.`
        };
      }

      const url = `https://${shopDomain}/admin/api/${this.apiVersion}/webhooks/${webhookId}.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': tokenData.accessToken
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: 'Failed to get webhook',
          message: `Failed to get webhook: ${response.status} ${response.statusText}`,
          data: errorData as any
        };
      }

      const result = await response.json() as { webhook: ShopifyWebhook };
      return {
        success: true,
        data: result.webhook,
        message: 'Webhook retrieved successfully'
      };
    } catch (error) {
      console.error('Webhook retrieval error:', error);
      return {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve webhook'
      };
    }
  }
}

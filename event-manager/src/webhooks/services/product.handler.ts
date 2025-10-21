import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { BaseWebhookHandler } from './base.handler';
import { productClient } from '../../services/clients/index';
import { errorHandlingService } from '../../services/core/index';

/**
 * Product Webhook Handler
 * 
 * Processes product-related webhooks (create, update, delete)
 */
export class ProductWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event
    await this.logEvent(topic, shop, data);
    
    try {
      let result: WebhookHandlerResult;
      
      switch (topic) {
        case WEBHOOK_TOPICS.PRODUCTS_CREATE:
          result = await this.handleProductCreate(data, shop);
          break;
        case WEBHOOK_TOPICS.PRODUCTS_UPDATE:
          result = await this.handleProductUpdate(data, shop);
          break;
        case WEBHOOK_TOPICS.PRODUCTS_DELETE:
          result = await this.handleProductDelete(data, shop);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported product webhook topic: ${topic}`
          };
      }
      
      return result;
    } catch (error) {
      console.error('Product webhook handler error:', error);
      
      return {
        success: false,
        message: 'Failed to process product webhook',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleProductCreate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Product created in shop ${shop}:`, {
      productId: data.id,
      title: data.title,
      handle: data.handle,
      vendor: data.vendor
    });
    
    try {
      // Get access token for the shop
      const accessToken = await this.getAccessToken(shop);
      if (!accessToken) {
        // Log webhook but skip Shopify API call if no token
        return {
          success: true,
          message: 'Product creation webhook logged (Shopify API sync skipped - no access token)',
          data: { productId: data.id, action: 'created', synchronized: false, reason: 'no_token' }
        };
      }

      // Fetch full product data using GraphQL client
      const result = await productClient.getProduct(
        `gid://shopify/Product/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getProduct',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'product_create' }
        },
        {
          shopDomain: shop,
          accessToken: accessToken,
          apiVersion: process.env['SHOPIFY_API_VERSION'] || '2024-01'
        }
      );

      if (result.success && result.data) {
        const productData = (result.data.data as any)?.product;
        
        if (productData) {
          // Extract product ID from GID
          const productId = productData.id.replace('gid://shopify/Product/', '');
          
          // Save product data to DynamoDB
          const saveResult = await this.productService.saveProduct({
            shop_domain: shop,
            shopify_product_id: productId,
            title: productData.title,
            handle: productData.handle,
            vendor: productData.vendor || '',
            product_type: productData.productType || '',
            status: productData.status || 'ACTIVE',
            tags: productData.tags || [],
            description: productData.descriptionHtml || productData.description || '',
            variants: productData.variants?.nodes || [],
            images: productData.images?.nodes || [],
            options: productData.options || [],
            metafields: productData.metafields?.nodes || [],
            created_at: productData.createdAt || new Date().toISOString(),
            updated_at: productData.updatedAt || new Date().toISOString()
          });

          console.log('📦 Product data synchronized to DynamoDB:', {
            productId: productId,
            title: productData.title,
            variantsCount: productData.variants?.nodes?.length || 0,
            imagesCount: productData.images?.nodes?.length || 0,
            saved: saveResult.success
          });

          return {
            success: true,
            message: 'Product creation webhook processed and data saved to DynamoDB',
            data: { 
              productId: data.id, 
              action: 'created',
              synchronized: true,
              saved: saveResult.success,
              variantsCount: productData.variants?.nodes?.length || 0,
              imagesCount: productData.images?.nodes?.length || 0
            }
          };
        }
      }

      // If GraphQL fetch failed, still log the webhook but report the issue
      await errorHandlingService.handleWebhookError(
        new Error(`Failed to fetch product data: ${result.error?.message || 'Unknown error'}`),
        'products/create',
        shop,
        {
          service: 'product-webhook-handler',
          operation: 'handleProductCreate',
          additionalData: { productId: data.id, graphqlError: result.error?.message }
        }
      );

      return {
        success: true,
        message: 'Product creation webhook processed (data sync failed)',
        data: { productId: data.id, action: 'created', synchronized: false }
      };
    } catch (error) {
      await errorHandlingService.handleWebhookError(
        error,
        'products/create',
        shop,
        {
          service: 'product-webhook-handler',
          operation: 'handleProductCreate',
          additionalData: { productId: data.id }
        }
      );

      return {
        success: false,
        message: 'Failed to process product creation webhook',
        data: { productId: data.id, action: 'created', error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleProductUpdate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Product updated in shop ${shop}:`, {
      productId: data.id,
      title: data.title,
      handle: data.handle,
      vendor: data.vendor,
      updatedAt: data.updated_at
    });
    
    try {
      // Get access token for the shop
      const accessToken = await this.getAccessToken(shop);
      if (!accessToken) {
        // Log webhook but skip Shopify API call if no token
        return {
          success: true,
          message: 'Product update webhook logged (Shopify API sync skipped - no access token)',
          data: { productId: data.id, action: 'updated', synchronized: false, reason: 'no_token' }
        };
      }

      // Fetch updated product data using GraphQL client
      const result = await productClient.getProduct(
        `gid://shopify/Product/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getProduct',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'product_update' }
        },
        {
          shopDomain: shop,
          accessToken: accessToken,
          apiVersion: process.env['SHOPIFY_API_VERSION'] || '2024-01'
        }
      );

      if (result.success && result.data) {
        const productData = (result.data.data as any)?.product;
        if (productData) {
          // Extract product ID from GID
          const productId = productData.id.replace('gid://shopify/Product/', '');
          
          // Update product data in DynamoDB
          const saveResult = await this.productService.saveProduct({
            shop_domain: shop,
            shopify_product_id: productId,
            title: productData.title,
            handle: productData.handle,
            vendor: productData.vendor || '',
            product_type: productData.productType || '',
            status: productData.status || 'ACTIVE',
            tags: productData.tags || [],
            description: productData.descriptionHtml || productData.description || '',
            variants: productData.variants?.nodes || [],
            images: productData.images?.nodes || [],
            options: productData.options || [],
            metafields: productData.metafields?.nodes || [],
            created_at: productData.createdAt || new Date().toISOString(),
            updated_at: productData.updatedAt || new Date().toISOString()
          });

          console.log('📦 Product data updated in DynamoDB:', {
            productId: productId,
            title: productData.title,
            variantsCount: productData.variants?.nodes?.length || 0,
            imagesCount: productData.images?.nodes?.length || 0,
            updatedAt: productData.updatedAt,
            saved: saveResult.success
          });

          return {
            success: true,
            message: 'Product update webhook processed and data updated in DynamoDB',
            data: { 
              productId: data.id, 
              action: 'updated',
              synchronized: true,
              saved: saveResult.success,
              variantsCount: productData.variants?.nodes?.length || 0,
              imagesCount: productData.images?.nodes?.length || 0
            }
          };
        }
      }

      // If GraphQL fetch failed, still log the webhook but report the issue
      await errorHandlingService.handleWebhookError(
        new Error(`Failed to fetch updated product data: ${result.error?.message || 'Unknown error'}`),
        'products/update',
        shop,
        {
          service: 'product-webhook-handler',
          operation: 'handleProductUpdate',
          additionalData: { productId: data.id, graphqlError: result.error?.message }
        }
      );

      return {
        success: true,
        message: 'Product update webhook processed (data sync failed)',
        data: { productId: data.id, action: 'updated', synchronized: false }
      };
    } catch (error) {
      await errorHandlingService.handleWebhookError(
        error,
        'products/update',
        shop,
        {
          service: 'product-webhook-handler',
          operation: 'handleProductUpdate',
          additionalData: { productId: data.id }
        }
      );

      return {
        success: false,
        message: 'Failed to process product update webhook',
        data: { productId: data.id, action: 'updated', error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleProductDelete(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Product deleted in shop ${shop}:`, {
      productId: data.id,
      title: data.title,
      handle: data.handle
    });
    
    try {
      // Delete product from DynamoDB
      const deleteResult = await this.productService.deleteProduct(shop, data.id.toString());
      
      console.log(`📦 Product deleted from DynamoDB: ${data.id}`, {
        success: deleteResult.success
      });
      
      return {
        success: true,
        message: 'Product deletion webhook processed and removed from DynamoDB',
        data: { productId: data.id, action: 'deleted', removed: deleteResult.success }
      };
    } catch (error) {
      console.error('Failed to delete product from DynamoDB:', error);
      return {
        success: true,
        message: 'Product deletion webhook logged (DynamoDB deletion failed)',
        data: { productId: data.id, action: 'deleted', removed: false }
      };
    }
  }
}


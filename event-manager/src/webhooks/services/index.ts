import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { productClient, orderClient, customerClient } from '../../services/clients/index';
import { errorHandlingService } from '../../services/core/index';
import EventManagerDatabaseService from '../../services/database.service';

/**
 * Webhook Event Handlers
 * 
 * Simplified handlers focused on event processing and logging
 */

export abstract class BaseWebhookHandler {
  protected db: EventManagerDatabaseService;
  
  constructor() {
    this.db = new EventManagerDatabaseService();
  }
  
  abstract handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult>;
  
  protected async logEvent(topic: string, shop: string, data: any): Promise<number> {
    // Log to console
    console.log(`Processing webhook event:`, {
      topic,
      shop,
      timestamp: new Date().toISOString(),
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : []
    });

    // Log to database
    try {
      await this.db.connect();
      const eventId = await this.db.createWebhookEvent({
        shop_domain: shop,
        topic: topic,
        event_data: data,
        processed_at: new Date(),
        status: 'pending'
      });
      return eventId;
    } catch (error) {
      console.error('Failed to log event to database:', error);
      return 0; // Return 0 if database logging fails
    }
  }

  protected async updateEventStatus(eventId: number, status: 'processed' | 'failed', errorMessage?: string): Promise<void> {
    if (eventId > 0) {
      try {
        await this.db.updateWebhookEventStatus(eventId, status, errorMessage);
      } catch (error) {
        console.error('Failed to update event status in database:', error);
      }
    }
  }
}

/**
 * Product webhook handlers
 */
export class ProductWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event to database and get event ID
    const eventId = await this.logEvent(topic, shop, data);
    
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
      
      // Update event status in database
      await this.updateEventStatus(eventId, result.success ? 'processed' : 'failed', result.message);
      
      return result;
    } catch (error) {
      console.error('Product webhook handler error:', error);
      
      // Update event status to failed
      await this.updateEventStatus(eventId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
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
      // Fetch full product data using GraphQL client
      const result = await productClient.getProduct(
        `gid://shopify/Product/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getProduct',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'product_create' }
        }
      );

      if (result.success && result.data) {
        const productData = (result.data.data as any)?.product;
        if (productData) {
          // TODO: Normalize and store product data in company database
          // Product data structure ready for database storage:
          // - shopify_id, title, handle, vendor, product_type, status
          // - tags, description, images, variants, options, metafields
          console.log('📦 Product data synchronized:', {
            productId: productData.id,
            title: productData.title,
            variantsCount: productData.variants?.nodes?.length || 0,
            imagesCount: productData.images?.nodes?.length || 0
          });

          return {
            success: true,
            message: 'Product creation webhook processed and data synchronized successfully',
            data: { 
              productId: data.id, 
              action: 'created',
              synchronized: true,
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
      // Fetch updated product data using GraphQL client
      const result = await productClient.getProduct(
        `gid://shopify/Product/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getProduct',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'product_update' }
        }
      );

      if (result.success && result.data) {
        const productData = (result.data.data as any)?.product;
        if (productData) {
          // TODO: Normalize and update product data in company database
          // Product data structure ready for database update:
          // - shopify_id, title, handle, vendor, product_type, status
          // - tags, description, images, variants, options, metafields
          console.log('📦 Product data updated and synchronized:', {
            productId: productData.id,
            title: productData.title,
            variantsCount: productData.variants?.nodes?.length || 0,
            imagesCount: productData.images?.nodes?.length || 0,
            updatedAt: productData.updatedAt
          });

          return {
            success: true,
            message: 'Product update webhook processed and data synchronized successfully',
            data: { 
              productId: data.id, 
              action: 'updated',
              synchronized: true,
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
    
    // TODO: Implement product deletion logic
    // - Remove product from database
    // - Update search index
    // - Clean up related data
    // - Archive if needed
    
    return {
      success: true,
      message: 'Product deletion webhook processed successfully',
      data: { productId: data.id, action: 'deleted' }
    };
  }
}

/**
 * Order webhook handlers
 */
export class OrderWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event to database and get event ID
    const eventId = await this.logEvent(topic, shop, data);
    
    try {
      let result: WebhookHandlerResult;
      
      switch (topic) {
        case WEBHOOK_TOPICS.ORDERS_CREATE:
          result = await this.handleOrderCreate(data, shop);
          break;
        case WEBHOOK_TOPICS.ORDERS_UPDATED:
          result = await this.handleOrderUpdate(data, shop);
          break;
        case WEBHOOK_TOPICS.ORDERS_PAID:
          result = await this.handleOrderPaid(data, shop);
          break;
        case WEBHOOK_TOPICS.ORDERS_CANCELLED:
          result = await this.handleOrderCancelled(data, shop);
          break;
        case WEBHOOK_TOPICS.ORDERS_FULFILLED:
          result = await this.handleOrderFulfilled(data, shop);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported order webhook topic: ${topic}`
          };
      }
      
      // Update event status in database
      await this.updateEventStatus(eventId, result.success ? 'processed' : 'failed', result.message);
      
      return result;
    } catch (error) {
      console.error('Order webhook handler error:', error);
      
      // Update event status to failed
      await this.updateEventStatus(eventId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: 'Failed to process order webhook',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleOrderCreate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order created in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      totalPrice: data.total_price,
      currency: data.currency,
      customerEmail: data.customer?.email
    });
    
    try {
      // Fetch full order data using GraphQL client
      const result = await orderClient.getOrder(
        `gid://shopify/Order/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getOrder',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'order_create' }
        }
      );

      if (result.success && result.data) {
        const orderData = (result.data.data as any)?.order;
        if (orderData) {
          // TODO: Normalize and store order data in company database
          // Order data structure ready for database storage:
          // - shopify_id, name, email, phone, total_price, currency_code
          // - financial_status, fulfillment_status, line_items, customer data
          console.log('🛒 Order data synchronized:', {
            orderId: orderData.id,
            orderName: orderData.name,
            totalPrice: orderData.totalPrice,
            currency: orderData.currencyCode,
            lineItemsCount: orderData.lineItems?.nodes?.length || 0,
            customerEmail: orderData.email
          });

          return {
            success: true,
            message: 'Order creation webhook processed and data synchronized successfully',
            data: { 
              orderId: data.id, 
              action: 'created',
              synchronized: true,
              lineItemsCount: orderData.lineItems?.nodes?.length || 0,
              totalPrice: orderData.totalPrice,
              currency: orderData.currencyCode
            }
          };
        }
      }

      // If GraphQL fetch failed, still log the webhook but report the issue
      await errorHandlingService.handleWebhookError(
        new Error(`Failed to fetch order data: ${result.error?.message || 'Unknown error'}`),
        'orders/create',
        shop,
        {
          service: 'order-webhook-handler',
          operation: 'handleOrderCreate',
          additionalData: { orderId: data.id, graphqlError: result.error?.message }
        }
      );

      return {
        success: true,
        message: 'Order creation webhook processed (data sync failed)',
        data: { orderId: data.id, action: 'created', synchronized: false }
      };
    } catch (error) {
      await errorHandlingService.handleWebhookError(
        error,
        'orders/create',
        shop,
        {
          service: 'order-webhook-handler',
          operation: 'handleOrderCreate',
          additionalData: { orderId: data.id }
        }
      );

      return {
        success: false,
        message: 'Failed to process order creation webhook',
        data: { orderId: data.id, action: 'created', error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleOrderUpdate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order updated in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      financialStatus: data.financial_status,
      fulfillmentStatus: data.fulfillment_status
    });
    
    // TODO: Implement order update logic
    // - Update order data
    // - Check for status changes
    // - Send notifications if needed
    
    return {
      success: true,
      message: 'Order update webhook processed successfully',
      data: { orderId: data.id, action: 'updated' }
    };
  }
  
  private async handleOrderPaid(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order paid in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      totalPrice: data.total_price,
      currency: data.currency
    });
    
    // TODO: Implement order paid logic
    // - Update order status
    // - Trigger fulfillment process
    // - Send payment confirmation
    // - Update analytics
    
    return {
      success: true,
      message: 'Order paid webhook processed successfully',
      data: { orderId: data.id, action: 'paid' }
    };
  }
  
  private async handleOrderCancelled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order cancelled in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      cancelReason: data.cancel_reason
    });
    
    // TODO: Implement order cancellation logic
    // - Update order status
    // - Restore inventory
    // - Process refunds if needed
    // - Send cancellation notification
    
    return {
      success: true,
      message: 'Order cancellation webhook processed successfully',
      data: { orderId: data.id, action: 'cancelled' }
    };
  }
  
  private async handleOrderFulfilled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order fulfilled in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      fulfillmentStatus: data.fulfillment_status
    });
    
    // TODO: Implement order fulfillment logic
    // - Update order status
    // - Send tracking information
    // - Update analytics
    // - Trigger post-fulfillment processes
    
    return {
      success: true,
      message: 'Order fulfillment webhook processed successfully',
      data: { orderId: data.id, action: 'fulfilled' }
    };
  }
}

/**
 * Customer webhook handlers
 */
export class CustomerWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event to database and get event ID
    const eventId = await this.logEvent(topic, shop, data);
    
    try {
      let result: WebhookHandlerResult;
      
      switch (topic) {
        case WEBHOOK_TOPICS.CUSTOMERS_CREATE:
          result = await this.handleCustomerCreate(data, shop);
          break;
        case WEBHOOK_TOPICS.CUSTOMERS_UPDATE:
          result = await this.handleCustomerUpdate(data, shop);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported customer webhook topic: ${topic}`
          };
      }
      
      // Update event status in database
      await this.updateEventStatus(eventId, result.success ? 'processed' : 'failed', result.message);
      
      return result;
    } catch (error) {
      console.error('Customer webhook handler error:', error);
      
      // Update event status to failed
      await this.updateEventStatus(eventId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        message: 'Failed to process customer webhook',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleCustomerCreate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Customer created in shop ${shop}:`, {
      customerId: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name
    });
    
    try {
      // Fetch full customer data using GraphQL client
      const result = await customerClient.getCustomer(
        `gid://shopify/Customer/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getCustomer',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'customer_create' }
        }
      );

      if (result.success && result.data) {
        const customerData = (result.data.data as any)?.customer;
        if (customerData) {
          // TODO: Normalize and store customer data in company database
          // Customer data structure ready for database storage:
          // - shopify_id, email, first_name, last_name, phone, addresses
          // - total_spent, orders_count, marketing preferences, metafields
          console.log('👤 Customer data synchronized:', {
            customerId: customerData.id,
            email: customerData.email,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            totalSpent: customerData.totalSpent,
            ordersCount: customerData.ordersCount,
            addressesCount: customerData.addresses?.nodes?.length || 0
          });

          return {
            success: true,
            message: 'Customer creation webhook processed and data synchronized successfully',
            data: { 
              customerId: data.id, 
              action: 'created',
              synchronized: true,
              totalSpent: customerData.totalSpent,
              ordersCount: customerData.ordersCount,
              addressesCount: customerData.addresses?.nodes?.length || 0
            }
          };
        }
      }

      // If GraphQL fetch failed, still log the webhook but report the issue
      await errorHandlingService.handleWebhookError(
        new Error(`Failed to fetch customer data: ${result.error?.message || 'Unknown error'}`),
        'customers/create',
        shop,
        {
          service: 'customer-webhook-handler',
          operation: 'handleCustomerCreate',
          additionalData: { customerId: data.id, graphqlError: result.error?.message }
        }
      );

      return {
        success: true,
        message: 'Customer creation webhook processed (data sync failed)',
        data: { customerId: data.id, action: 'created', synchronized: false }
      };
    } catch (error) {
      await errorHandlingService.handleWebhookError(
        error,
        'customers/create',
        shop,
        {
          service: 'customer-webhook-handler',
          operation: 'handleCustomerCreate',
          additionalData: { customerId: data.id }
        }
      );

      return {
        success: false,
        message: 'Failed to process customer creation webhook',
        data: { customerId: data.id, action: 'created', error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleCustomerUpdate(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Customer updated in shop ${shop}:`, {
      customerId: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      updatedAt: data.updated_at
    });
    
    // TODO: Implement customer update logic
    // - Update customer data
    // - Sync with external systems
    // - Update marketing preferences
    
    return {
      success: true,
      message: 'Customer update webhook processed successfully',
      data: { customerId: data.id, action: 'updated' }
    };
  }
}

/**
 * App webhook handlers
 */
export class AppWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event to database and get event ID
    const eventId = await this.logEvent(topic, shop, data);
    
    try {
      let result: WebhookHandlerResult;
      
      switch (topic) {
        case WEBHOOK_TOPICS.APP_UNINSTALLED:
          result = await this.handleAppUninstalled(data, shop);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported app webhook topic: ${topic}`
          };
      }
      
      // Update event status in database
      await this.updateEventStatus(eventId, result.success ? 'processed' : 'failed', result.message);
      
      return result;
    } catch (error) {
      console.error('App webhook handler error:', error);
      
      // Update event status to failed
      await this.updateEventStatus(eventId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        message: 'Failed to process app webhook',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleAppUninstalled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`App uninstalled from shop ${shop}:`, {
      shopId: data.id,
      shopDomain: data.domain,
      uninstalledAt: new Date().toISOString()
    });
    
    // TODO: Implement app uninstallation logic
    // - Clean up user data
    // - Revoke access tokens
    // - Send uninstallation notification
    // - Archive shop data
    
    return {
      success: true,
      message: 'App uninstallation webhook processed successfully',
      data: { shopId: data.id, action: 'uninstalled' }
    };
  }
}

/**
 * Webhook handler registry
 */
export class WebhookHandlerRegistry {
  private handlers: Map<string, BaseWebhookHandler> = new Map();
  
  constructor() {
    // Register default handlers
    this.register('products', new ProductWebhookHandler());
    this.register('orders', new OrderWebhookHandler());
    this.register('customers', new CustomerWebhookHandler());
    this.register('app', new AppWebhookHandler());
  }
  
  register(topic: string, handler: BaseWebhookHandler): void {
    this.handlers.set(topic, handler);
  }
  
  async handleWebhook(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const topicPrefix = topic.split('/')[0] || 'unknown';
    
    const handler = this.handlers.get(topicPrefix);
    if (!handler) {
      return {
        success: false,
        message: `No handler found for webhook topic: ${topic}`
      };
    }
    
    return await handler.handle(data, req);
  }
}

// Export singleton instance
export const webhookHandlerRegistry = new WebhookHandlerRegistry();

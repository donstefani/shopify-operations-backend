import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { BaseWebhookHandler } from './base.handler';
import { orderClient } from '../../services/clients/index';
import { errorHandlingService } from '../../services/core/index';

/**
 * Order Webhook Handler
 * 
 * Processes order-related webhooks (create, update, paid, cancelled, fulfilled)
 */
export class OrderWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event
    await this.logEvent(topic, shop, data);
    
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
      
      return result;
    } catch (error) {
      console.error('Order webhook handler error:', error);
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
      // Get access token for the shop
      const accessToken = await this.getAccessToken(shop);
      if (!accessToken) {
        // Log webhook but skip Shopify API call if no token
        return {
          success: true,
          message: 'Order creation webhook logged (Shopify API sync skipped - no access token)',
          data: { orderId: data.id, action: 'created', synchronized: false, reason: 'no_token' }
        };
      }

      // Fetch full order data using GraphQL client
      const result = await orderClient.getOrder(
        `gid://shopify/Order/${data.id}`,
        {
          shopDomain: shop,
          operation: 'getOrder',
          requestId: `webhook-${Date.now()}`,
          additionalData: { webhookEvent: 'order_create' }
        },
        {
          shopDomain: shop,
          accessToken: accessToken,
          apiVersion: process.env['SHOPIFY_API_VERSION'] || '2024-01'
        }
      );

      if (result.success && result.data) {
        const orderData = (result.data.data as any)?.order;
        if (orderData) {
          // Extract order ID from GID
          const orderId = orderData.id.replace('gid://shopify/Order/', '');
          
          // Save order data to DynamoDB
          const saveResult = await this.orderService.saveOrder({
            shop_domain: shop,
            shopify_order_id: orderId,
            order_name: orderData.name,
            order_number: orderData.orderNumber,
            email: orderData.email || '',
            phone: orderData.phone || '',
            total_price: orderData.totalPriceSet?.shopMoney?.amount || orderData.totalPrice || '0',
            subtotal_price: orderData.subtotalPriceSet?.shopMoney?.amount || '0',
            total_tax: orderData.totalTaxSet?.shopMoney?.amount || '0',
            currency: orderData.currencyCode || 'USD',
            financial_status: orderData.displayFinancialStatus || 'PENDING',
            fulfillment_status: orderData.displayFulfillmentStatus || 'UNFULFILLED',
            line_items: orderData.lineItems?.nodes || [],
            customer_data: orderData.customer || {},
            shipping_address: orderData.shippingAddress || {},
            billing_address: orderData.billingAddress || {},
            note: orderData.note || '',
            tags: orderData.tags || [],
            created_at: orderData.createdAt || new Date().toISOString(),
            updated_at: orderData.updatedAt || new Date().toISOString(),
            processed_at: orderData.processedAt || new Date().toISOString()
          });

          console.log('🛒 Order data synchronized to DynamoDB:', {
            orderId: orderId,
            orderName: orderData.name,
            totalPrice: orderData.totalPrice,
            currency: orderData.currencyCode,
            lineItemsCount: orderData.lineItems?.nodes?.length || 0,
            customerEmail: orderData.email,
            saved: saveResult.success
          });

          return {
            success: true,
            message: 'Order creation webhook processed and data saved to DynamoDB',
            data: { 
              orderId: data.id, 
              action: 'created',
              synchronized: true,
              saved: saveResult.success,
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
    
    try {
      // Update order financial and fulfillment status in DynamoDB
      if (data.financial_status) {
        await this.orderService.updateOrderFinancialStatus(shop, data.id.toString(), data.financial_status);
      }
      
      if (data.fulfillment_status) {
        await this.orderService.updateOrderFulfillmentStatus(shop, data.id.toString(), data.fulfillment_status);
      }
      
      return {
        success: true,
        message: 'Order update webhook processed and status updated in DynamoDB',
        data: { orderId: data.id, action: 'updated' }
      };
    } catch (error) {
      console.error('Failed to update order in DynamoDB:', error);
      return {
        success: true,
        message: 'Order update webhook logged (DynamoDB update failed)',
        data: { orderId: data.id, action: 'updated', updated: false }
      };
    }
  }
  
  private async handleOrderPaid(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order paid in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      totalPrice: data.total_price,
      currency: data.currency
    });
    
    try {
      // Update order financial status to PAID
      await this.orderService.updateOrderFinancialStatus(shop, data.id.toString(), 'PAID');
      
      return {
        success: true,
        message: 'Order paid webhook processed and status updated in DynamoDB',
        data: { orderId: data.id, action: 'paid' }
      };
    } catch (error) {
      console.error('Failed to update order payment status:', error);
      return {
        success: true,
        message: 'Order paid webhook logged (DynamoDB update failed)',
        data: { orderId: data.id, action: 'paid', updated: false }
      };
    }
  }
  
  private async handleOrderCancelled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order cancelled in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      cancelReason: data.cancel_reason
    });
    
    try {
      // Update order status to CANCELLED
      await this.orderService.updateOrderFinancialStatus(shop, data.id.toString(), 'CANCELLED');
      
      return {
        success: true,
        message: 'Order cancellation webhook processed and status updated in DynamoDB',
        data: { orderId: data.id, action: 'cancelled' }
      };
    } catch (error) {
      console.error('Failed to update order cancellation status:', error);
      return {
        success: true,
        message: 'Order cancellation webhook logged (DynamoDB update failed)',
        data: { orderId: data.id, action: 'cancelled', updated: false }
      };
    }
  }
  
  private async handleOrderFulfilled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`Order fulfilled in shop ${shop}:`, {
      orderId: data.id,
      orderNumber: data.order_number,
      fulfillmentStatus: data.fulfillment_status
    });
    
    try {
      // Update order fulfillment status to FULFILLED
      await this.orderService.updateOrderFulfillmentStatus(shop, data.id.toString(), 'FULFILLED');
      
      return {
        success: true,
        message: 'Order fulfillment webhook processed and status updated in DynamoDB',
        data: { orderId: data.id, action: 'fulfilled' }
      };
    } catch (error) {
      console.error('Failed to update order fulfillment status:', error);
      return {
        success: true,
        message: 'Order fulfillment webhook logged (DynamoDB update failed)',
        data: { orderId: data.id, action: 'fulfilled', updated: false }
      };
    }
  }
}


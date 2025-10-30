import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { BaseWebhookHandler } from './base.handler';
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

  /**
   * Handle customer relationship for orders
   * Checks if customer exists, creates if not, returns customer ID
   */
  private async handleCustomerRelationship(customerData: any, shop: string): Promise<string | undefined> {
    if (!customerData || !customerData.id) {
      return undefined;
    }

    try {
      // Check if customer already exists
      const existingCustomer = await this.customerService.getCustomer(shop, customerData.id.toString());
      
      if (existingCustomer.success && existingCustomer.data) {
        console.log(`👤 Customer already exists: ${customerData.id} (${customerData.email})`);
        return existingCustomer.data.shop_customer_id;
      }

      // Customer doesn't exist, create it
      console.log(`👤 Creating new customer from order: ${customerData.id} (${customerData.email})`);
      
      const saveResult = await this.customerService.saveCustomer({
        shop_domain: shop,
        shopify_customer_id: customerData.id.toString(),
        email: customerData.email || '',
        first_name: customerData.first_name || '',
        last_name: customerData.last_name || '',
        phone: customerData.phone || '',
        addresses: customerData.addresses || [],
        default_address: customerData.default_address || {},
        total_spent: customerData.total_spent || '0',
        orders_count: customerData.orders_count || 0,
        state: customerData.state || 'DISABLED',
        verified_email: customerData.verified_email || false,
        tax_exempt: customerData.tax_exempt || false,
        tags: Array.isArray(customerData.tags) ? customerData.tags : (customerData.tags ? customerData.tags.split(', ') : []),
        note: customerData.note || '',
        accepts_marketing: customerData.accepts_marketing || false,
        marketing_opt_in_level: customerData.marketing_opt_in_level || 'UNKNOWN',
        created_at: customerData.created_at || new Date().toISOString(),
        updated_at: customerData.updated_at || new Date().toISOString()
      });

      if (saveResult.success && saveResult.data) {
        console.log(`✅ Customer created from order: ${saveResult.data.shop_customer_id}`);
        return saveResult.data.shop_customer_id;
      } else {
        console.warn(`⚠️  Failed to create customer from order: ${saveResult.message}`);
        return undefined;
      }
    } catch (error) {
      console.error('❌ Error handling customer relationship:', error);
      return undefined;
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
      // Handle customer relationship first
      let customerId: string | undefined;
      if (data.customer && data.customer.id) {
        customerId = await this.handleCustomerRelationship(data.customer, shop);
      }

      // Save order data directly from webhook payload (webhook contains all needed data)
      // Note: GraphQL API access to orders is restricted due to protected customer data
      const saveResult = await this.orderService.saveOrder({
          shop_domain: shop,
          shopify_order_id: data.id.toString(),
          order_name: data.name || `#${data.order_number}`,
          order_number: data.order_number,
          email: data.email || data.contact_email || '',
          phone: data.phone || '',
          total_price: data.total_price || '0',
          subtotal_price: data.subtotal_price || '0',
          total_tax: data.total_tax || '0',
          total_discounts: data.total_discounts || '0',
          total_line_items_price: data.total_line_items_price || '0',
          current_total_price: data.current_total_price || data.total_price || '0',
          current_total_tax: data.current_total_tax || data.total_tax || '0',
          currency: data.currency || 'USD',
          presentment_currency: data.presentment_currency || data.currency || 'USD',
          financial_status: data.financial_status || 'PENDING',
          fulfillment_status: data.fulfillment_status || 'UNFULFILLED',
          processing_method: data.processing_method || '',
          gateway: data.gateway || '',
          source_name: data.source_name || 'web',
          line_items: data.line_items || [],
          shipping_lines: data.shipping_lines || [],
          discount_codes: data.discount_codes || [],
          customer_data: data.customer || {},
          customer_id: customerId,
          shipping_address: data.shipping_address || {},
          billing_address: data.billing_address || {},
          note: data.note || '',
          tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(', ') : []),
          buyer_accepts_marketing: data.buyer_accepts_marketing || false,
          confirmed: data.confirmed || false,
          taxes_included: data.taxes_included || false,
          test: data.test || false,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          processed_at: data.processed_at || new Date().toISOString(),
          closed_at: data.closed_at || null,
          cancelled_at: data.cancelled_at || null,
          cancel_reason: data.cancel_reason || null
        });

        // Update customer spending information if customer exists
        console.log('🔍 Checking customer spending update conditions:', {
          customerId,
          hasCustomerData: !!data.customer,
          customerIdFromData: data.customer?.id
        });
        
        if (customerId && data.customer && data.customer.id) {
          try {
            // Calculate new total spent and orders count
            const orderTotal = parseFloat(data.total_price || '0');
            
            // Get current customer data to calculate new totals
            const customerResult = await this.customerService.getCustomer(shop, data.customer.id.toString());
            if (customerResult.success && customerResult.data) {
              const currentCustomer = customerResult.data;
              const currentTotalSpent = parseFloat(currentCustomer.total_spent || '0');
              const currentOrdersCount = currentCustomer.orders_count || 0;
              
              const newTotalSpent = (currentTotalSpent + orderTotal).toString();
              const newOrdersCount = currentOrdersCount + 1;
              
              await this.customerService.updateCustomerSpending(
                shop,
                data.customer.id.toString(),
                newTotalSpent,
                newOrdersCount
              );
              
              console.log('💰 Updated customer spending:', {
                customerId: data.customer.id,
                orderTotal,
                newTotalSpent,
                newOrdersCount
              });
            }
          } catch (error) {
            console.error('❌ Failed to update customer spending:', error);
            // Don't fail the order processing if customer update fails
          }
        }

        return {
          success: true,
          message: 'Order creation webhook processed and data saved to DynamoDB (from webhook payload)',
          data: { orderId: data.id, action: 'created', synchronized: true, saved: saveResult.success, customerId }
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


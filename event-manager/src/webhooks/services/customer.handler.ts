import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { BaseWebhookHandler } from './base.handler';
import { errorHandlingService } from '../../services/core/index';

/**
 * Customer Webhook Handler
 * 
 * Processes customer-related webhooks (create, update)
 */
export class CustomerWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event
    await this.logEvent(topic, shop, data);
    
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
      
      return result;
    } catch (error) {
      console.error('Customer webhook handler error:', error);
      
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
      // Save customer data directly from webhook payload
      // Note: GraphQL API is blocked for protected customer data, but webhook payload contains all needed data
      const saveResult = await this.customerService.saveCustomer({
        shop_domain: shop,
        shopify_customer_id: data.id.toString(),
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        addresses: data.addresses || [],
        default_address: data.default_address || {},
        total_spent: data.total_spent || '0',
        orders_count: data.orders_count || 0,
        state: data.state || 'DISABLED',
        verified_email: data.verified_email || false,
        tax_exempt: data.tax_exempt || false,
        tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(', ') : []),
        note: data.note || '',
        accepts_marketing: data.accepts_marketing || false,
        marketing_opt_in_level: data.marketing_opt_in_level || 'UNKNOWN',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      });

      console.log('👤 Customer data saved to DynamoDB from webhook payload:', {
        customerId: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        addressesCount: data.addresses?.length || 0,
        saved: saveResult.success
      });

      return {
        success: true,
        message: 'Customer creation webhook processed and data saved to DynamoDB',
        data: { 
          customerId: data.id, 
          action: 'created',
          synchronized: true,
          saved: saveResult.success,
          source: 'webhook_payload'
        }
      };
    } catch (error) {
      console.error('Failed to save customer from webhook payload:', error);
      
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
    
    try {
      // Update customer spending info if available
      if (data.total_spent !== undefined || data.orders_count !== undefined) {
        await this.customerService.updateCustomerSpending(
          shop,
          data.id.toString(),
          data.total_spent || '0',
          data.orders_count || 0
        );
      }
      
      // Update marketing preferences if changed
      if (data.accepts_marketing !== undefined) {
        await this.customerService.updateMarketingPreferences(
          shop,
          data.id.toString(),
          data.accepts_marketing,
          data.marketing_opt_in_level
        );
      }
      
      return {
        success: true,
        message: 'Customer update webhook processed and data updated in DynamoDB',
        data: { customerId: data.id, action: 'updated' }
      };
    } catch (error) {
      console.error('Failed to update customer in DynamoDB:', error);
      return {
        success: true,
        message: 'Customer update webhook logged (DynamoDB update failed)',
        data: { customerId: data.id, action: 'updated', updated: false }
      };
    }
  }
}


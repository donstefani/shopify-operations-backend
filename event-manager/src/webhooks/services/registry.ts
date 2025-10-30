import { WebhookRequest, WebhookHandlerResult } from '../types/index';
import { BaseWebhookHandler } from './base.handler';
import { ProductWebhookHandler } from './product.handler';
import { OrderWebhookHandler } from './order.handler';
import { CustomerWebhookHandler } from './customer.handler';
import { AppWebhookHandler } from './app.handler';

/**
 * Webhook Handler Registry
 * 
 * Central registry that routes webhook events to the appropriate handler
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
  
  /**
   * Register a custom webhook handler
   */
  register(topic: string, handler: BaseWebhookHandler): void {
    this.handlers.set(topic, handler);
  }
  
  /**
   * Handle incoming webhook by routing to appropriate handler
   */
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


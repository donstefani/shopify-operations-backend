import { WebhookRequest, WebhookHandlerResult } from '../types/index';
import { ProductDynamoDBService } from '../../services/dynamodb/product.service';
import { OrderDynamoDBService } from '../../services/dynamodb/order.service';
import { CustomerDynamoDBService } from '../../services/dynamodb/customer.service';
import { WebhookEventDynamoDBService } from '../../services/dynamodb/webhook-event.service';
import { TokenService } from '../../services/token.service';

/**
 * Base Webhook Handler
 * 
 * Abstract base class providing shared functionality for all webhook handlers
 */
export abstract class BaseWebhookHandler {
  protected productService: ProductDynamoDBService;
  protected orderService: OrderDynamoDBService;
  protected customerService: CustomerDynamoDBService;
  protected webhookEventService: WebhookEventDynamoDBService;
  protected tokenService: TokenService;
  
  constructor() {
    this.productService = new ProductDynamoDBService();
    this.orderService = new OrderDynamoDBService();
    this.customerService = new CustomerDynamoDBService();
    this.webhookEventService = new WebhookEventDynamoDBService();
    this.tokenService = new TokenService();
  }
  
  /**
   * Handle webhook event - must be implemented by subclasses
   */
  abstract handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult>;
  
  /**
   * Log webhook event to console and DynamoDB
   */
  protected async logEvent(topic: string, shop: string, data: any): Promise<string> {
    console.log(`Processing webhook event:`, {
      topic,
      shop,
      timestamp: new Date().toISOString(),
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : []
    });

    try {
      // Save webhook event to DynamoDB
      const result = await this.webhookEventService.saveWebhookEvent(shop, topic, data);
      
      if (result.success && result.data) {
        console.log(`✅ Webhook event logged to DynamoDB: ${result.data.event_id}`);
        return result.data.event_id;
      } else {
        console.warn(`⚠️  Failed to save webhook event to DynamoDB: ${result.message}`);
        // Return a fallback event ID even if DynamoDB write failed
        return `${shop}#${topic}#${Date.now()}`;
      }
    } catch (error) {
      console.error('❌ Error logging webhook event to DynamoDB:', error);
      // Return a fallback event ID even if DynamoDB write failed
      return `${shop}#${topic}#${Date.now()}`;
    }
  }

  /**
   * Get access token for a shop from auth-service
   */
  protected async getAccessToken(shopDomain: string): Promise<string | null> {
    try {
      const tokenData = await this.tokenService.getToken(shopDomain);
      if (!tokenData) {
        console.warn(`⚠️  No access token found for shop: ${shopDomain}`);
        return null;
      }
      return tokenData.accessToken;
    } catch (error) {
      console.error(`Failed to get access token for ${shopDomain}:`, error);
      return null;
    }
  }
}


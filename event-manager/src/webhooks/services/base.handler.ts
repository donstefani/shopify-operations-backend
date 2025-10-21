import { WebhookRequest, WebhookHandlerResult } from '../types/index';
import { ProductDynamoDBService } from '../../services/dynamodb/product.service';
import { OrderDynamoDBService } from '../../services/dynamodb/order.service';
import { CustomerDynamoDBService } from '../../services/dynamodb/customer.service';
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
  protected tokenService: TokenService;
  
  constructor() {
    this.productService = new ProductDynamoDBService();
    this.orderService = new OrderDynamoDBService();
    this.customerService = new CustomerDynamoDBService();
    this.tokenService = new TokenService();
  }
  
  /**
   * Handle webhook event - must be implemented by subclasses
   */
  abstract handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult>;
  
  /**
   * Log webhook event to console
   */
  protected async logEvent(topic: string, shop: string, data: any): Promise<string> {
    console.log(`Processing webhook event:`, {
      topic,
      shop,
      timestamp: new Date().toISOString(),
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : []
    });

    // Return an event ID for reference
    const eventId = `${shop}#${topic}#${Date.now()}`;
    return eventId;
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


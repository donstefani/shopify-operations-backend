import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

/**
 * Webhook Event DynamoDB Service
 * 
 * Handles webhook event storage and retrieval from DynamoDB
 */
export interface WebhookEvent {
  event_id: string;
  shop_domain: string;
  topic: string;
  created_at: string;
  event_data: any;
  ttl: number; // Time to live for automatic cleanup (Unix timestamp)
}

export class WebhookEventDynamoDBService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
    this.tableName = process.env['WEBHOOK_EVENTS_TABLE_NAME'] || 'operations-event-manager-webhook-events-dev';
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(shopDomain: string, topic: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${shopDomain}#${topic}#${timestamp}#${random}`;
  }

  /**
   * Save a webhook event to DynamoDB
   */
  async saveWebhookEvent(
    shopDomain: string, 
    topic: string, 
    eventData: any
  ): Promise<{ success: boolean; message: string; data?: WebhookEvent }> {
    try {
      const eventId = this.generateEventId(shopDomain, topic);
      const now = new Date().toISOString();
      
      // Set TTL to 30 days from now (30 * 24 * 60 * 60 = 2,592,000 seconds)
      const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      
      const item: WebhookEvent = {
        event_id: eventId,
        shop_domain: shopDomain,
        topic: topic,
        created_at: now,
        event_data: eventData,
        ttl: ttl
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item
      });

      await this.client.send(command);

      console.log(`✅ Webhook event saved to DynamoDB: ${topic} from ${shopDomain} (${eventId})`);

      return {
        success: true,
        message: 'Webhook event saved successfully',
        data: item
      };
    } catch (error) {
      console.error('❌ Error saving webhook event to DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save webhook event'
      };
    }
  }

  /**
   * Get a webhook event by ID
   */
  async getWebhookEvent(eventId: string): Promise<{ success: boolean; message: string; data?: WebhookEvent }> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { event_id: eventId }
      });

      const result = await this.client.send(command);

      if (!result.Item) {
        return {
          success: false,
          message: 'Webhook event not found'
        };
      }

      return {
        success: true,
        message: 'Webhook event retrieved successfully',
        data: result.Item as WebhookEvent
      };
    } catch (error) {
      console.error('❌ Error getting webhook event from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get webhook event'
      };
    }
  }

  /**
   * Get webhook events by shop domain
   */
  async getWebhookEventsByShop(
    shopDomain: string, 
    limit: number = 50
  ): Promise<{ success: boolean; message: string; data?: WebhookEvent[] }> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'shop_domain-created_at-index',
        KeyConditionExpression: 'shop_domain = :shop_domain',
        ExpressionAttributeValues: {
          ':shop_domain': shopDomain
        },
        ScanIndexForward: false, // Sort by created_at descending (newest first)
        Limit: limit
      });

      const result = await this.client.send(command);

      return {
        success: true,
        message: 'Webhook events retrieved successfully',
        data: result.Items as WebhookEvent[]
      };
    } catch (error) {
      console.error('❌ Error getting webhook events by shop from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get webhook events by shop'
      };
    }
  }

  /**
   * Get webhook events by topic
   */
  async getWebhookEventsByTopic(
    topic: string, 
    limit: number = 50
  ): Promise<{ success: boolean; message: string; data?: WebhookEvent[] }> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'topic-created_at-index',
        KeyConditionExpression: 'topic = :topic',
        ExpressionAttributeValues: {
          ':topic': topic
        },
        ScanIndexForward: false, // Sort by created_at descending (newest first)
        Limit: limit
      });

      const result = await this.client.send(command);

      return {
        success: true,
        message: 'Webhook events retrieved successfully',
        data: result.Items as WebhookEvent[]
      };
    } catch (error) {
      console.error('❌ Error getting webhook events by topic from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get webhook events by topic'
      };
    }
  }
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB Order Service
 * 
 * Handles CRUD operations for Shopify orders in DynamoDB
 */

export interface ShopifyOrder {
  shop_order_id: string;  // Composite: shop_domain#order_id
  shop_domain: string;
  shopify_order_id: string;
  order_name: string;  // e.g., "#1001"
  order_number?: number;
  email?: string;
  phone?: string;
  total_price: string;
  subtotal_price?: string;
  total_tax?: string;
  total_discounts?: string;
  total_line_items_price?: string;
  current_total_price?: string;
  current_total_tax?: string;
  currency: string;
  presentment_currency?: string;
  financial_status: string;
  fulfillment_status?: string;
  processing_method?: string;
  gateway?: string;
  source_name?: string;
  line_items: any[];
  shipping_lines?: any[];
  discount_codes?: any[];
  customer_data?: any;
  customer_id?: string | undefined;  // Reference to customer table
  shipping_address?: any;
  billing_address?: any;
  note?: string;
  tags?: string[];
  buyer_accepts_marketing?: boolean;
  confirmed?: boolean;
  taxes_included?: boolean;
  test?: boolean;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  closed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
}

export class OrderDynamoDBService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(ddbClient);
    this.tableName = process.env['ORDERS_TABLE_NAME'] || 'shopify-orders-dev';
  }

  /**
   * Create composite key from shop domain and order ID
   */
  private generateKey(shopDomain: string, orderId: string): string {
    return `${shopDomain}#${orderId}`;
  }

  /**
   * Create or update an order
   */
  async saveOrder(order: Omit<ShopifyOrder, 'shop_order_id'>): Promise<{ success: boolean; message: string; data?: ShopifyOrder }> {
    try {
      const shop_order_id = this.generateKey(order.shop_domain, order.shopify_order_id);
      
      const item: ShopifyOrder = {
        shop_order_id,
        ...order,
        updated_at: new Date().toISOString()
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item
      });

      await this.client.send(command);

      console.log(`✅ Order saved to DynamoDB: ${item.order_name} (${shop_order_id})`);

      return {
        success: true,
        message: 'Order saved successfully',
        data: item
      };
    } catch (error) {
      console.error('❌ Error saving order to DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save order'
      };
    }
  }

  /**
   * Get an order by shop domain and order ID
   */
  async getOrder(shopDomain: string, orderId: string): Promise<{ success: boolean; message: string; data?: ShopifyOrder }> {
    try {
      const shop_order_id = this.generateKey(shopDomain, orderId);

      const command = new GetCommand({
        TableName: this.tableName,
        Key: { shop_order_id }
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return {
          success: false,
          message: 'Order not found'
        };
      }

      return {
        success: true,
        message: 'Order retrieved successfully',
        data: response.Item as ShopifyOrder
      };
    } catch (error) {
      console.error('❌ Error getting order from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get order'
      };
    }
  }

  /**
   * Get all orders for a shop
   */
  async getOrdersByShop(shopDomain: string, limit: number = 100): Promise<{ success: boolean; message: string; data?: ShopifyOrder[]; lastKey?: any }> {
    try {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'shop_domain-created_at-index',
        KeyConditionExpression: 'shop_domain = :shop',
        ExpressionAttributeValues: {
          ':shop': shopDomain
        },
        Limit: limit,
        ScanIndexForward: false  // Most recent first
      };

      const command = new QueryCommand(params);
      const response = await this.client.send(command);

      return {
        success: true,
        message: `Found ${response.Items?.length || 0} orders`,
        data: (response.Items as ShopifyOrder[]) || [],
        lastKey: response.LastEvaluatedKey
      };
    } catch (error) {
      console.error('❌ Error querying orders from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to query orders'
      };
    }
  }

  /**
   * Get orders by customer email
   */
  async getOrdersByEmail(email: string, limit: number = 100): Promise<{ success: boolean; message: string; data?: ShopifyOrder[]; lastKey?: any }> {
    try {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'email-created_at-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        },
        Limit: limit,
        ScanIndexForward: false  // Most recent first
      };

      const command = new QueryCommand(params);
      const response = await this.client.send(command);

      return {
        success: true,
        message: `Found ${response.Items?.length || 0} orders for ${email}`,
        data: (response.Items as ShopifyOrder[]) || [],
        lastKey: response.LastEvaluatedKey
      };
    } catch (error) {
      console.error('❌ Error querying orders by email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to query orders by email'
      };
    }
  }

  /**
   * Update order financial status
   */
  async updateOrderFinancialStatus(shopDomain: string, orderId: string, financialStatus: string): Promise<{ success: boolean; message: string }> {
    try {
      const shop_order_id = this.generateKey(shopDomain, orderId);

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { shop_order_id },
        UpdateExpression: 'SET financial_status = :status, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':status': financialStatus,
          ':updated_at': new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'Order financial status updated successfully'
      };
    } catch (error) {
      console.error('❌ Error updating order financial status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update order financial status'
      };
    }
  }

  /**
   * Update order fulfillment status
   */
  async updateOrderFulfillmentStatus(shopDomain: string, orderId: string, fulfillmentStatus: string): Promise<{ success: boolean; message: string }> {
    try {
      const shop_order_id = this.generateKey(shopDomain, orderId);

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { shop_order_id },
        UpdateExpression: 'SET fulfillment_status = :status, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':status': fulfillmentStatus,
          ':updated_at': new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'Order fulfillment status updated successfully'
      };
    } catch (error) {
      console.error('❌ Error updating order fulfillment status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update order fulfillment status'
      };
    }
  }
}


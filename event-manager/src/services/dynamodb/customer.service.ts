import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB Customer Service
 * 
 * Handles CRUD operations for Shopify customers in DynamoDB
 */

export interface ShopifyCustomer {
  shop_customer_id: string;  // Composite: shop_domain#customer_id
  shop_domain: string;
  shopify_customer_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  addresses?: any[];
  default_address?: any;
  total_spent?: string;
  orders_count?: number;
  state?: string;
  verified_email?: boolean;
  tax_exempt?: boolean;
  tags?: string[];
  note?: string;
  accepts_marketing?: boolean;
  marketing_opt_in_level?: string;
  created_at: string;
  updated_at: string;
}

export class CustomerDynamoDBService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(ddbClient);
    this.tableName = process.env['CUSTOMERS_TABLE_NAME'] || 'shopify-customers-dev';
  }

  /**
   * Create composite key from shop domain and customer ID
   */
  private generateKey(shopDomain: string, customerId: string): string {
    return `${shopDomain}#${customerId}`;
  }

  /**
   * Create or update a customer
   */
  async saveCustomer(customer: Omit<ShopifyCustomer, 'shop_customer_id'>): Promise<{ success: boolean; message: string; data?: ShopifyCustomer }> {
    try {
      const shop_customer_id = this.generateKey(customer.shop_domain, customer.shopify_customer_id);
      
      const item: ShopifyCustomer = {
        shop_customer_id,
        ...customer,
        updated_at: new Date().toISOString()
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item
      });

      await this.client.send(command);

      console.log(`✅ Customer saved to DynamoDB: ${item.email || item.shopify_customer_id} (${shop_customer_id})`);

      return {
        success: true,
        message: 'Customer saved successfully',
        data: item
      };
    } catch (error) {
      console.error('❌ Error saving customer to DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save customer'
      };
    }
  }

  /**
   * Get a customer by shop domain and customer ID
   */
  async getCustomer(shopDomain: string, customerId: string): Promise<{ success: boolean; message: string; data?: ShopifyCustomer }> {
    try {
      const shop_customer_id = this.generateKey(shopDomain, customerId);

      const command = new GetCommand({
        TableName: this.tableName,
        Key: { shop_customer_id }
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      return {
        success: true,
        message: 'Customer retrieved successfully',
        data: response.Item as ShopifyCustomer
      };
    } catch (error) {
      console.error('❌ Error getting customer from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get customer'
      };
    }
  }

  /**
   * Get all customers for a shop
   */
  async getCustomersByShop(shopDomain: string, limit: number = 100): Promise<{ success: boolean; message: string; data?: ShopifyCustomer[]; lastKey?: any }> {
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
        message: `Found ${response.Items?.length || 0} customers`,
        data: (response.Items as ShopifyCustomer[]) || [],
        lastKey: response.LastEvaluatedKey
      };
    } catch (error) {
      console.error('❌ Error querying customers from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to query customers'
      };
    }
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<{ success: boolean; message: string; data?: ShopifyCustomer }> {
    try {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        },
        Limit: 1
      };

      const command = new QueryCommand(params);
      const response = await this.client.send(command);

      if (!response.Items || response.Items.length === 0) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      return {
        success: true,
        message: 'Customer retrieved successfully',
        data: response.Items[0] as ShopifyCustomer
      };
    } catch (error) {
      console.error('❌ Error getting customer by email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get customer by email'
      };
    }
  }

  /**
   * Update customer spending info
   */
  async updateCustomerSpending(shopDomain: string, customerId: string, totalSpent: string, ordersCount: number): Promise<{ success: boolean; message: string }> {
    try {
      const shop_customer_id = this.generateKey(shopDomain, customerId);

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { shop_customer_id },
        UpdateExpression: 'SET total_spent = :spent, orders_count = :count, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':spent': totalSpent,
          ':count': ordersCount,
          ':updated_at': new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'Customer spending updated successfully'
      };
    } catch (error) {
      console.error('❌ Error updating customer spending:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update customer spending'
      };
    }
  }

  /**
   * Update customer marketing preferences
   */
  async updateMarketingPreferences(shopDomain: string, customerId: string, acceptsMarketing: boolean, optInLevel?: string): Promise<{ success: boolean; message: string }> {
    try {
      const shop_customer_id = this.generateKey(shopDomain, customerId);

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { shop_customer_id },
        UpdateExpression: 'SET accepts_marketing = :marketing, marketing_opt_in_level = :level, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':marketing': acceptsMarketing,
          ':level': optInLevel || 'unknown',
          ':updated_at': new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'Customer marketing preferences updated successfully'
      };
    } catch (error) {
      console.error('❌ Error updating customer marketing preferences:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update marketing preferences'
      };
    }
  }
}


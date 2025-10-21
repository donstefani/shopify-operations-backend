import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB Product Service
 * 
 * Handles CRUD operations for Shopify products in DynamoDB
 */

export interface ShopifyProduct {
  shop_product_id: string;  // Composite: shop_domain#product_id
  shop_domain: string;
  shopify_product_id: string;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  status: string;
  tags?: string[];
  description?: string;
  variants?: any[];
  images?: any[];
  options?: any[];
  metafields?: any[];
  created_at: string;
  updated_at: string;
}

export class ProductDynamoDBService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(ddbClient);
    this.tableName = process.env['PRODUCTS_TABLE_NAME'] || 'shopify-products-dev';
  }

  /**
   * Create composite key from shop domain and product ID
   */
  private generateKey(shopDomain: string, productId: string): string {
    return `${shopDomain}#${productId}`;
  }

  /**
   * Create or update a product
   */
  async saveProduct(product: Omit<ShopifyProduct, 'shop_product_id'>): Promise<{ success: boolean; message: string; data?: ShopifyProduct }> {
    try {
      const shop_product_id = this.generateKey(product.shop_domain, product.shopify_product_id);
      
      const item: ShopifyProduct = {
        shop_product_id,
        ...product,
        updated_at: new Date().toISOString()
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item
      });

      await this.client.send(command);

      console.log(`✅ Product saved to DynamoDB: ${item.title} (${shop_product_id})`);

      return {
        success: true,
        message: 'Product saved successfully',
        data: item
      };
    } catch (error) {
      console.error('❌ Error saving product to DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save product'
      };
    }
  }

  /**
   * Get a product by shop domain and product ID
   */
  async getProduct(shopDomain: string, productId: string): Promise<{ success: boolean; message: string; data?: ShopifyProduct }> {
    try {
      const shop_product_id = this.generateKey(shopDomain, productId);

      const command = new GetCommand({
        TableName: this.tableName,
        Key: { shop_product_id }
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return {
          success: false,
          message: 'Product not found'
        };
      }

      return {
        success: true,
        message: 'Product retrieved successfully',
        data: response.Item as ShopifyProduct
      };
    } catch (error) {
      console.error('❌ Error getting product from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get product'
      };
    }
  }

  /**
   * Get all products for a shop
   */
  async getProductsByShop(shopDomain: string, limit: number = 100): Promise<{ success: boolean; message: string; data?: ShopifyProduct[]; lastKey?: any }> {
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
        message: `Found ${response.Items?.length || 0} products`,
        data: (response.Items as ShopifyProduct[]) || [],
        lastKey: response.LastEvaluatedKey
      };
    } catch (error) {
      console.error('❌ Error querying products from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to query products'
      };
    }
  }

  /**
   * Update product status
   */
  async updateProductStatus(shopDomain: string, productId: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      const shop_product_id = this.generateKey(shopDomain, productId);

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { shop_product_id },
        UpdateExpression: 'SET #status = :status, updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updated_at': new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'Product status updated successfully'
      };
    } catch (error) {
      console.error('❌ Error updating product status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update product status'
      };
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(shopDomain: string, productId: string): Promise<{ success: boolean; message: string }> {
    try {
      const shop_product_id = this.generateKey(shopDomain, productId);

      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { shop_product_id }
      });

      await this.client.send(command);

      console.log(`✅ Product deleted from DynamoDB: ${shop_product_id}`);

      return {
        success: true,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('❌ Error deleting product from DynamoDB:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete product'
      };
    }
  }
}


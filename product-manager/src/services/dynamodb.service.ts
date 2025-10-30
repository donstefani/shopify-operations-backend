import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Product, DynamoDBProduct, ProductStatus, SyncStatus } from '../types';

export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.DYNAMODB_TABLE || 'operations-event-manager-products-dev';
  }

  /**
   * Convert DynamoDB item to Product
   */
  private toDomainModel(item: DynamoDBProduct): Product {
    return {
      id: item.product_id,
      shopifyId: item.shopify_id,
      shopDomain: item.shop_domain,
      title: item.title,
      handle: item.handle,
      vendor: item.vendor,
      productType: item.product_type,
      tags: item.tags,
      price: item.price,
      inventoryQuantity: item.inventory_quantity,
      status: item.status as ProductStatus,
      syncStatus: item.sync_status as SyncStatus,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  /**
   * Convert Product to DynamoDB item
   */
  private toDBModel(product: Partial<Product>): Partial<DynamoDBProduct> {
    const dbItem: Partial<DynamoDBProduct> = {
      shop_domain: product.shopDomain,
      product_id: product.id,
      shopify_id: product.shopifyId,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      product_type: product.productType,
      tags: product.tags,
      price: product.price,
      inventory_quantity: product.inventoryQuantity,
      status: product.status,
      sync_status: product.syncStatus,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    };

    // Remove undefined values
    Object.keys(dbItem).forEach(key => {
      if (dbItem[key as keyof DynamoDBProduct] === undefined) {
        delete dbItem[key as keyof DynamoDBProduct];
      }
    });

    return dbItem;
  }

  /**
   * Create a new product
   */
  async createProduct(product: Product): Promise<Product> {
    const dbItem = this.toDBModel(product);

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: dbItem,
      })
    );

    return product;
  }

  /**
   * Get a single product by shop domain and shopify ID
   */
  async getProduct(shopDomain: string, shopifyId: string): Promise<Product | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          shop_domain: shopDomain,
          product_id: `PRODUCT#${shopifyId}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.toDomainModel(result.Item as DynamoDBProduct);
  }

  /**
   * List products with pagination and filters
   */
  async listProducts(
    shopDomain: string,
    limit: number = 20,
    exclusiveStartKey?: Record<string, any>,
    filters?: { status?: ProductStatus; search?: string }
  ): Promise<{ items: Product[]; lastEvaluatedKey?: Record<string, any>; count: number }> {
    const params: any = {
      TableName: this.tableName,
      KeyConditionExpression: 'shop_domain = :shop_domain',
      ExpressionAttributeValues: {
        ':shop_domain': shopDomain,
      },
      Limit: limit,
    };

    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }

    // Add filter expressions if provided
    if (filters) {
      const filterExpressions: string[] = [];
      
      if (filters.status) {
        filterExpressions.push('#status = :status');
        params.ExpressionAttributeValues[':status'] = filters.status;
        params.ExpressionAttributeNames = {
          ...params.ExpressionAttributeNames,
          '#status': 'status',
        };
      }

      if (filters.search) {
        filterExpressions.push('(contains(#title, :search) OR contains(#handle, :search))');
        params.ExpressionAttributeValues[':search'] = filters.search;
        params.ExpressionAttributeNames = {
          ...params.ExpressionAttributeNames,
          '#title': 'title',
          '#handle': 'handle',
        };
      }

      if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
      }
    }

    const result = await this.client.send(new QueryCommand(params));

    const items = (result.Items || []).map(item => this.toDomainModel(item as DynamoDBProduct));

    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
    };
  }

  /**
   * Update a product
   */
  async updateProduct(
    shopDomain: string,
    shopifyId: string,
    updates: Partial<Product>
  ): Promise<Product> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression
    const dbUpdates = this.toDBModel(updates);
    let index = 0;

    Object.entries(dbUpdates).forEach(([key, value]) => {
      if (key !== 'shop_domain' && key !== 'product_id' && value !== undefined) {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = value;
        index++;
      }
    });

    // Always update the updated_at timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          shop_domain: shopDomain,
          product_id: `PRODUCT#${shopifyId}`,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    // Fetch and return the updated product
    const updatedProduct = await this.getProduct(shopDomain, shopifyId);
    if (!updatedProduct) {
      throw new Error('Product not found after update');
    }

    return updatedProduct;
  }

  /**
   * Delete a product
   */
  async deleteProduct(shopDomain: string, shopifyId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          shop_domain: shopDomain,
          product_id: `PRODUCT#${shopifyId}`,
        },
      })
    );
  }

  /**
   * Get product statistics
   */
  async getProductStats(shopDomain: string): Promise<{
    total: number;
    byStatus: { active: number; draft: number; archived: number };
  }> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'shop_domain-created_at-index',
        KeyConditionExpression: 'shop_domain = :shop_domain',
        ExpressionAttributeValues: {
          ':shop_domain': shopDomain,
        },
        ProjectionExpression: '#status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
      })
    );

    const items = result.Items || [];
    const stats = {
      total: items.length,
      byStatus: {
        active: 0,
        draft: 0,
        archived: 0,
      },
    };

    items.forEach(item => {
      const status = item.status?.toLowerCase();
      if (status === 'active') stats.byStatus.active++;
      else if (status === 'draft') stats.byStatus.draft++;
      else if (status === 'archived') stats.byStatus.archived++;
    });

    return stats;
  }
}


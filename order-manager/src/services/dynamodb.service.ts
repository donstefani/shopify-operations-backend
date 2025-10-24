import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Order, DynamoDBOrder, SyncStatus, OrderFilters, OrderStats } from '../types';

export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.DYNAMODB_TABLE || 'operations-event-manager-orders-dev';
  }

  private toDomainModel(item: DynamoDBOrder): Order {
    return {
      id: item.order_id,
      shopifyId: item.shopify_id,
      shopDomain: item.shop_domain,
      orderNumber: item.order_number,
      customerId: item.customer_id,
      customerEmail: item.customer_email,
      totalPrice: item.total_price,
      currency: item.currency,
      status: item.status,
      fulfillmentStatus: item.fulfillment_status,
      financialStatus: item.financial_status,
      syncStatus: item.sync_status as SyncStatus,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  private toDBModel(order: Partial<Order>): Partial<DynamoDBOrder> {
    const dbItem: Partial<DynamoDBOrder> = {
      shop_domain: order.shopDomain,
      order_id: order.id,
      shopify_id: order.shopifyId,
      order_number: order.orderNumber,
      customer_id: order.customerId,
      customer_email: order.customerEmail,
      total_price: order.totalPrice,
      currency: order.currency,
      status: order.status,
      fulfillment_status: order.fulfillmentStatus,
      financial_status: order.financialStatus,
      sync_status: order.syncStatus,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    };

    Object.keys(dbItem).forEach(key => {
      if (dbItem[key as keyof DynamoDBOrder] === undefined) {
        delete dbItem[key as keyof DynamoDBOrder];
      }
    });

    return dbItem;
  }

  async createOrder(order: Order): Promise<Order> {
    const dbItem = this.toDBModel(order);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: dbItem,
    }));
    return order;
  }

  async getOrder(shopDomain: string, shopifyId: string): Promise<Order | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        shop_domain: shopDomain,
        order_id: `ORDER#${shopifyId}`,
      },
    }));

    if (!result.Item) return null;
    return this.toDomainModel(result.Item as DynamoDBOrder);
  }

  async listOrders(
    shopDomain: string,
    limit: number = 20,
    exclusiveStartKey?: Record<string, any>,
    filters?: OrderFilters
  ): Promise<{ items: Order[]; lastEvaluatedKey?: Record<string, any>; count: number }> {
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

    if (filters) {
      const filterExpressions: string[] = [];
      
      if (filters.status) {
        filterExpressions.push('#status = :status');
        params.ExpressionAttributeValues[':status'] = filters.status;
        params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#status': 'status' };
      }

      if (filters.customerEmail) {
        filterExpressions.push('customer_email = :email');
        params.ExpressionAttributeValues[':email'] = filters.customerEmail;
      }

      if (filters.orderNumber) {
        filterExpressions.push('order_number = :orderNumber');
        params.ExpressionAttributeValues[':orderNumber'] = filters.orderNumber;
      }

      if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
      }
    }

    const result = await this.client.send(new QueryCommand(params));
    const items = (result.Items || []).map(item => this.toDomainModel(item as DynamoDBOrder));

    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
    };
  }

  async updateOrder(shopDomain: string, shopifyId: string, updates: Partial<Order>): Promise<Order> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    const dbUpdates = this.toDBModel(updates);
    let index = 0;

    Object.entries(dbUpdates).forEach(([key, value]) => {
      if (key !== 'shop_domain' && key !== 'order_id' && value !== undefined) {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = value;
        index++;
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: {
        shop_domain: shopDomain,
        order_id: `ORDER#${shopifyId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    const updatedOrder = await this.getOrder(shopDomain, shopifyId);
    if (!updatedOrder) {
      throw new Error('Order not found after update');
    }

    return updatedOrder;
  }

  async deleteOrder(shopDomain: string, shopifyId: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        shop_domain: shopDomain,
        order_id: `ORDER#${shopifyId}`,
      },
    }));
  }

  async getOrderStats(shopDomain: string): Promise<OrderStats> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'shop_domain-created_at-index',
      KeyConditionExpression: 'shop_domain = :shop_domain',
      ExpressionAttributeValues: {
        ':shop_domain': shopDomain,
      },
      ProjectionExpression: '#status, total_price, financial_status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    }));

    const items = result.Items || [];
    const stats = {
      total: items.length,
      totalRevenue: 0,
      byStatus: {
        pending: 0,
        paid: 0,
        fulfilled: 0,
        cancelled: 0,
      },
    };

    items.forEach(item => {
      stats.totalRevenue += item.total_price || 0;
      const finStatus = item.financial_status?.toLowerCase();
      if (finStatus === 'pending') stats.byStatus.pending++;
      else if (finStatus === 'paid') stats.byStatus.paid++;
      else if (item.status?.toLowerCase() === 'fulfilled') stats.byStatus.fulfilled++;
      else if (item.status?.toLowerCase() === 'cancelled') stats.byStatus.cancelled++;
    });

    return stats;
  }
}


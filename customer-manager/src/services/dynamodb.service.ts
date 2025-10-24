import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Customer, DynamoDBCustomer, CustomerState, SyncStatus, CustomerFilters } from '../types';

export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.DYNAMODB_TABLE || 'operations-event-manager-customers-dev';
  }

  private toDomainModel(item: DynamoDBCustomer): Customer {
    return {
      id: item.shop_customer_id, // Use the primary key as the ID
      shopifyId: item.shopify_customer_id, // Use the correct field name
      shopDomain: item.shop_domain,
      email: item.email,
      firstName: item.first_name,
      lastName: item.last_name,
      phone: item.phone,
      totalSpent: typeof item.total_spent === 'string' ? parseFloat(item.total_spent) : (item.total_spent || 0),
      ordersCount: typeof item.orders_count === 'string' ? parseInt(item.orders_count) : (item.orders_count || 0),
      state: (item.state?.toUpperCase() as CustomerState) || CustomerState.DISABLED,
      syncStatus: (item.sync_status as SyncStatus) || SyncStatus.SYNCED, // Default to SYNCED if not specified
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  private toDBModel(customer: Partial<Customer>): Partial<DynamoDBCustomer> {
    const dbItem: Partial<DynamoDBCustomer> = {
      shop_customer_id: `${customer.shopDomain}#${customer.shopifyId}`, // Generate composite primary key
      shop_domain: customer.shopDomain,
      shopify_customer_id: customer.shopifyId,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone: customer.phone,
      total_spent: customer.totalSpent,
      orders_count: customer.ordersCount,
      state: customer.state,
      sync_status: customer.syncStatus,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    };

    Object.keys(dbItem).forEach(key => {
      if (dbItem[key as keyof DynamoDBCustomer] === undefined) {
        delete dbItem[key as keyof DynamoDBCustomer];
      }
    });

    return dbItem;
  }

  async createCustomer(customer: Customer): Promise<Customer> {
    const dbItem = this.toDBModel(customer);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: dbItem,
    }));
    return customer;
  }

  async getCustomer(shopDomain: string, shopifyId: string): Promise<Customer | null> {
    // Use the GSI to find the customer by shop_domain and shopify_id
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'shop_domain-created_at-index',
      KeyConditionExpression: 'shop_domain = :shop_domain',
      FilterExpression: 'shopify_customer_id = :shopify_id',
      ExpressionAttributeValues: {
        ':shop_domain': shopDomain,
        ':shopify_id': shopifyId,
      },
    }));

    if (!result.Items || result.Items.length === 0) return null;
    return this.toDomainModel(result.Items[0] as DynamoDBCustomer);
  }

  async listCustomers(
    shopDomain: string,
    limit: number = 20,
    exclusiveStartKey?: Record<string, any>,
    filters?: CustomerFilters
  ): Promise<{ items: Customer[]; lastEvaluatedKey?: Record<string, any>; count: number }> {
    const params: any = {
      TableName: this.tableName,
      IndexName: 'shop_domain-created_at-index', // Use the GSI to query by shop_domain
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
      
      if (filters.state) {
        filterExpressions.push('#state = :state');
        params.ExpressionAttributeValues[':state'] = filters.state;
        params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#state': 'state' };
      }

      if (filters.search) {
        filterExpressions.push('(contains(email, :search) OR contains(first_name, :search) OR contains(last_name, :search))');
        params.ExpressionAttributeValues[':search'] = filters.search;
      }

      if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
      }
    }

    const result = await this.client.send(new QueryCommand(params));
    const items = (result.Items || []).map(item => this.toDomainModel(item as DynamoDBCustomer));

    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
    };
  }

  async updateCustomer(shopDomain: string, shopifyId: string, updates: Partial<Customer>): Promise<Customer> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    const dbUpdates = this.toDBModel(updates);
    let index = 0;

    Object.entries(dbUpdates).forEach(([key, value]) => {
      if (key !== 'shop_domain' && key !== 'customer_id' && value !== undefined) {
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
        customer_id: `CUSTOMER#${shopifyId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    const updatedCustomer = await this.getCustomer(shopDomain, shopifyId);
    if (!updatedCustomer) {
      throw new Error('Customer not found after update');
    }

    return updatedCustomer;
  }

  async deleteCustomer(shopDomain: string, shopifyId: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        shop_domain: shopDomain,
        customer_id: `CUSTOMER#${shopifyId}`,
      },
    }));
  }

  async getCustomerStats(shopDomain: string): Promise<{
    total: number;
    totalLifetimeValue: number;
    averageOrderValue: number;
    byState: { enabled: number; disabled: number; invited: number; declined: number };
  }> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'shop_domain-created_at-index',
      KeyConditionExpression: 'shop_domain = :shop_domain',
      ExpressionAttributeValues: {
        ':shop_domain': shopDomain,
      },
      ProjectionExpression: '#state, total_spent, orders_count',
      ExpressionAttributeNames: {
        '#state': 'state',
      },
    }));

    const items = result.Items || [];
    const stats = {
      total: items.length,
      totalLifetimeValue: 0,
      averageOrderValue: 0,
      byState: {
        enabled: 0,
        disabled: 0,
        invited: 0,
        declined: 0,
      },
    };

    let totalOrders = 0;

    items.forEach(item => {
      stats.totalLifetimeValue += item.total_spent || 0;
      totalOrders += item.orders_count || 0;
      
      const state = item.state?.toLowerCase();
      if (state === 'enabled') stats.byState.enabled++;
      else if (state === 'disabled') stats.byState.disabled++;
      else if (state === 'invited') stats.byState.invited++;
      else if (state === 'declined') stats.byState.declined++;
    });

    stats.averageOrderValue = totalOrders > 0 ? stats.totalLifetimeValue / totalOrders : 0;

    return stats;
  }
}


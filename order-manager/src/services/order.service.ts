import { DynamoDBService } from './dynamodb.service';
import { TokenService } from './token.service';
import {
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  OrderFilters,
  OrderConnection,
  OrderStats,
  SyncStatus,
} from '../types';

export class OrderService {
  private dynamoDBService: DynamoDBService;
  private tokenService: TokenService;

  constructor() {
    this.dynamoDBService = new DynamoDBService();
    this.tokenService = new TokenService();
  }

  async listOrders(
    shopDomain: string,
    limit: number = 20,
    cursor?: string,
    filters?: OrderFilters
  ): Promise<OrderConnection> {
    let exclusiveStartKey: Record<string, any> | undefined;

    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch (error) {
        console.error('Invalid cursor:', error);
      }
    }

    const result = await this.dynamoDBService.listOrders(
      shopDomain,
      limit,
      exclusiveStartKey,
      filters
    );

    const endCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      items: result.items,
      pageInfo: {
        hasNextPage: !!result.lastEvaluatedKey,
        endCursor,
      },
      totalCount: result.count,
    };
  }

  async getOrder(shopDomain: string, shopifyId: string): Promise<Order | null> {
    return this.dynamoDBService.getOrder(shopDomain, shopifyId);
  }

  async createOrder(shopDomain: string, input: CreateOrderInput): Promise<Order> {
    const now = new Date().toISOString();
    const orderNumber = `#${Date.now()}`;

    const order: Order = {
      id: `ORDER#${Date.now()}`,
      shopifyId: '', // Will be updated after Shopify sync
      shopDomain,
      orderNumber,
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      totalPrice: input.totalPrice,
      currency: input.currency,
      status: input.status,
      syncStatus: SyncStatus.SYNCED, // Orders are typically read-only from Shopify
      createdAt: now,
      updatedAt: now,
    };

    return this.dynamoDBService.createOrder(order);
  }

  async updateOrder(
    shopDomain: string,
    shopifyId: string,
    input: UpdateOrderInput
  ): Promise<Order> {
    return this.dynamoDBService.updateOrder(shopDomain, shopifyId, {
      ...input,
      syncStatus: SyncStatus.SYNCED,
    });
  }

  async cancelOrder(shopDomain: string, shopifyId: string): Promise<Order> {
    return this.dynamoDBService.updateOrder(shopDomain, shopifyId, {
      status: 'cancelled',
      syncStatus: SyncStatus.SYNCED,
    });
  }

  async getOrderStats(shopDomain: string): Promise<OrderStats> {
    return this.dynamoDBService.getOrderStats(shopDomain);
  }
}


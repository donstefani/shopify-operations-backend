import { DynamoDBService } from './dynamodb.service';
import { TokenService } from './token.service';
import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilters,
  CustomerConnection,
  CustomerStats,
  CustomerState,
  SyncStatus,
} from '../types';

export class CustomerService {
  private dynamoDBService: DynamoDBService;
  private tokenService: TokenService;

  constructor() {
    this.dynamoDBService = new DynamoDBService();
    this.tokenService = new TokenService();
  }

  async listCustomers(
    shopDomain: string,
    limit: number = 20,
    cursor?: string,
    filters?: CustomerFilters
  ): Promise<CustomerConnection> {
    let exclusiveStartKey: Record<string, any> | undefined;

    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch (error) {
        console.error('Invalid cursor:', error);
      }
    }

    const result = await this.dynamoDBService.listCustomers(
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

  async getCustomer(shopDomain: string, shopifyId: string): Promise<Customer | null> {
    return this.dynamoDBService.getCustomer(shopDomain, shopifyId);
  }

  async createCustomer(shopDomain: string, input: CreateCustomerInput): Promise<Customer> {
    const now = new Date().toISOString();
    const tempId = `CUSTOMER#${Date.now()}`;

    const customer: Customer = {
      id: tempId,
      shopifyId: '',
      shopDomain,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      totalSpent: 0,
      ordersCount: 0,
      state: input.state || CustomerState.ENABLED,
      syncStatus: SyncStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    return this.dynamoDBService.createCustomer(customer);
  }

  async updateCustomer(
    shopDomain: string,
    shopifyId: string,
    input: UpdateCustomerInput
  ): Promise<Customer> {
    return this.dynamoDBService.updateCustomer(shopDomain, shopifyId, {
      ...input,
      syncStatus: SyncStatus.SYNCED,
    });
  }

  async deleteCustomer(shopDomain: string, shopifyId: string): Promise<boolean> {
    try {
      await this.dynamoDBService.deleteCustomer(shopDomain, shopifyId);
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw new Error(`Failed to delete customer: ${error}`);
    }
  }

  async getCustomerStats(shopDomain: string): Promise<CustomerStats> {
    return this.dynamoDBService.getCustomerStats(shopDomain);
  }
}


import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { webhookHandlerRegistry } from '../../src/webhooks/services/index';
import { WEBHOOK_TOPICS } from '../../src/webhooks/types/index';

// Create mock functions first
const mockGetProduct = jest.fn();
const mockGetOrder = jest.fn();
const mockGetCustomer = jest.fn();

const createAsyncVoidMock = () => {
  const mock = jest.fn() as jest.Mock;
  mock.mockImplementation(async () => undefined);
  return mock;
};

// Mock GraphQL clients
jest.mock('../../src/services/clients/index', () => ({
  productClient: {
    get getProduct() { return mockGetProduct; }
  },
  orderClient: {
    get getOrder() { return mockGetOrder; }
  },
  customerClient: {
    get getCustomer() { return mockGetCustomer; }
  }
}));

// Mock error handling service
jest.mock('../../src/services/core/error-handling.service', () => ({
  errorHandlingService: {
    handleError: createAsyncVoidMock(),
    handleGraphQLError: createAsyncVoidMock(),
    handleWebhookError: createAsyncVoidMock()
  }
}));

describe('Webhook Handler Registry', () => {
  beforeEach(() => {
    // Set up product client mock
    (mockGetProduct as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        data: {
          product: {
            id: 'gid://shopify/Product/12345',
            title: 'Test Product',
            handle: 'test-product',
            vendor: 'Test Vendor',
            variants: { nodes: [] },
            images: { nodes: [] }
          }
        }
      }
    }));

    // Set up order client mock
    (mockGetOrder as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        data: {
          order: {
            id: 'gid://shopify/Order/67890',
            name: '#1001',
            totalPrice: { amount: '29.99', currencyCode: 'USD' }
          }
        }
      }
    }));
  });

  test('should handle product creation webhook', async () => {
    const mockData = {
      id: 12345,
      title: 'Test Product',
      handle: 'test-product',
      vendor: 'Test Vendor'
    };

    const mockReq = {
      webhookTopic: WEBHOOK_TOPICS.PRODUCTS_CREATE,
      webhookShop: 'test-shop.myshopify.com',
      webhookId: 'test-webhook-id'
    } as any;

    const result = await webhookHandlerRegistry.handleWebhook(mockData, mockReq);

    if (!result.success) {
      console.error('Test failed - Result:', JSON.stringify(result, null, 2));
    }
    expect(result.success).toBe(true);
    expect(result.message).toContain('Product creation webhook processed');
    expect(result.data).toMatchObject({
      productId: 12345,
      action: 'created'
    });
  });

  test('should handle order creation webhook', async () => {
    const mockData = {
      id: 67890,
      order_number: 1001,
      total_price: '29.99',
      currency: 'USD',
      customer: {
        email: 'test@example.com'
      }
    };

    const mockReq = {
      webhookTopic: WEBHOOK_TOPICS.ORDERS_CREATE,
      webhookShop: 'test-shop.myshopify.com',
      webhookId: 'test-webhook-id'
    } as any;

    const result = await webhookHandlerRegistry.handleWebhook(mockData, mockReq);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Order creation webhook processed');
    expect(result.data).toMatchObject({
      orderId: 67890,
      action: 'created'
    });
  });

  test('should handle unsupported webhook topic', async () => {
    const mockData = { id: 123 };
    const mockReq = {
      webhookTopic: 'unsupported/topic',
      webhookShop: 'test-shop.myshopify.com'
    } as any;

    const result = await webhookHandlerRegistry.handleWebhook(mockData, mockReq);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No handler found for webhook topic');
  });
});

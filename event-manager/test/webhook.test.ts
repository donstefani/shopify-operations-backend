import { webhookHandlerRegistry } from '../src/webhooks/services/index.js';
import { WEBHOOK_TOPICS } from '../src/webhooks/types/index.js';

describe('Webhook Handler Registry', () => {
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

    expect(result.success).toBe(true);
    expect(result.message).toContain('Product creation webhook processed successfully');
    expect(result.data).toEqual({
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
    expect(result.message).toContain('Order creation webhook processed successfully');
    expect(result.data).toEqual({
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

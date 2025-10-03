/**
 * Throttling Service Tests
 * 
 * Tests the throttling service functionality including
 * retry logic, backoff calculations, and rate limit handling.
 */

import { ThrottlingService } from '../src/services/core/throttling.service';
import { ThrottlingConfig, ThrottlingContext } from '../src/types/errors.types';

// Mock the error handling service
jest.mock('../src/services/core/error-handling.service', () => ({
  errorHandlingService: {
    handleGraphQLError: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ThrottlingService', () => {
  let throttlingService: ThrottlingService;
  let mockOperation: jest.Mock;

  beforeEach(() => {
    throttlingService = new ThrottlingService();
    mockOperation = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithThrottling', () => {
    const context: ThrottlingContext = {
      shopDomain: 'test-shop.myshopify.com',
      operation: 'test-operation',
      requestId: 'test-request-123'
    };

    it('should execute operation successfully on first try', async () => {
      const expectedData = { success: true, data: 'test-data' };
      mockOperation.mockResolvedValue(expectedData);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedData);
      expect(result.retryCount).toBe(0);
      expect(result.totalDelay).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const expectedData = { success: true, data: 'test-data' };
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;

      // Fail twice, then succeed
      mockOperation
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(expectedData);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedData);
      expect(result.retryCount).toBe(2);
      expect(result.totalDelay).toBeGreaterThan(0);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      mockOperation.mockRejectedValue(error);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.retryCount).toBe(3); // maxRetries default is 3
      expect(result.totalDelay).toBeGreaterThan(0);
      expect(mockOperation).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).status = 401;
      mockOperation.mockRejectedValue(error);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.retryCount).toBe(0);
      expect(result.totalDelay).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect custom configuration', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      mockOperation.mockRejectedValue(error);

      const customConfig: Partial<ThrottlingConfig> = {
        maxRetries: 1,
        baseDelay: 100,
        backoffMultiplier: 1.5
      };

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context,
        customConfig
      );

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(1); // Should only retry once
      expect(mockOperation).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should skip throttling when disabled', async () => {
      const error = new Error('Some error');
      mockOperation.mockRejectedValue(error);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context,
        { enabled: false }
      );

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(result.totalDelay).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseRateLimitHeaders', () => {
    it('should parse valid rate limit headers', () => {
      const headers = {
        'x-shopify-api-call-limit': '40',
        'x-shopify-shop-api-call-limit': '35/40',
        'x-shopify-api-version': '2023-10'
      };

      const result = throttlingService.parseRateLimitHeaders(headers);

      expect(result).toEqual({
        requestedQueryCost: 40,
        actualQueryCost: 40,
        throttleStatus: {
          maximumAvailable: 40,
          currentlyAvailable: 35,
          restoreRate: 2023
        }
      });
    });

    it('should return null for missing headers', () => {
      const headers = {};

      const result = throttlingService.parseRateLimitHeaders(headers);

      expect(result).toBeNull();
    });

    it('should handle malformed headers gracefully', () => {
      const headers = {
        'x-shopify-shop-api-call-limit': 'invalid/format'
      };

      const result = throttlingService.parseRateLimitHeaders(headers);

      // Should return default values for malformed headers
      expect(result).toEqual({
        requestedQueryCost: 0,
        actualQueryCost: 0,
        throttleStatus: {
          maximumAvailable: 0,
          currentlyAvailable: 0,
          restoreRate: 2
        }
      });
    });
  });

  describe('calculateBackoffDelay', () => {
    const config: ThrottlingConfig = {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: false,
      retryableStatusCodes: [429],
      respectShopifyRateLimits: true
    };

    it('should return 0 for first retry', () => {
      const delay = throttlingService.calculateBackoffDelay(0, config);
      expect(delay).toBe(0);
    });

    it('should calculate exponential backoff correctly', () => {
      const delay1 = throttlingService.calculateBackoffDelay(1, config);
      const delay2 = throttlingService.calculateBackoffDelay(2, config);
      const delay3 = throttlingService.calculateBackoffDelay(3, config);

      expect(delay1).toBe(1000); // baseDelay
      expect(delay2).toBe(2000); // baseDelay * 2
      expect(delay3).toBe(4000); // baseDelay * 4
    });

    it('should respect maximum delay', () => {
      const configWithLowMax = { ...config, maxDelay: 500 };
      const delay = throttlingService.calculateBackoffDelay(5, configWithLowMax);
      expect(delay).toBe(500);
    });

    it('should apply jitter when enabled', () => {
      const configWithJitter = { ...config, jitter: true };
      const delay1 = throttlingService.calculateBackoffDelay(1, configWithJitter);
      const delay2 = throttlingService.calculateBackoffDelay(1, configWithJitter);

      // With jitter, delays should be different (within ±25% of base delay)
      expect(delay1).not.toBe(delay2);
      expect(delay1).toBeGreaterThanOrEqual(750); // 1000 - 25%
      expect(delay1).toBeLessThanOrEqual(1250); // 1000 + 25%
    });
  });

  describe('shouldRetry', () => {
    const config: ThrottlingConfig = {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: false,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      respectShopifyRateLimits: true
    };

    it('should retry on retryable status codes', () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;

      const shouldRetry = throttlingService.shouldRetry(error, 0, config);
      expect(shouldRetry).toBe(true);
    });

    it('should not retry on non-retryable status codes', () => {
      const error = new Error('Authentication failed');
      (error as any).status = 401;

      const shouldRetry = throttlingService.shouldRetry(error, 0, config);
      expect(shouldRetry).toBe(false);
    });

    it('should retry on rate limit error messages', () => {
      const error = new Error('Rate limit exceeded');

      const shouldRetry = throttlingService.shouldRetry(error, 0, config);
      expect(shouldRetry).toBe(true);
    });

    it('should not retry when max retries exceeded', () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;

      const shouldRetry = throttlingService.shouldRetry(error, 3, config);
      expect(shouldRetry).toBe(false);
    });

    it('should retry on timeout errors', () => {
      const error = new Error('Request timeout');

      const shouldRetry = throttlingService.shouldRetry(error, 0, config);
      expect(shouldRetry).toBe(true);
    });
  });

  describe('error handling', () => {
    const context: ThrottlingContext = {
      shopDomain: 'test-shop.myshopify.com',
      operation: 'test-operation',
      requestId: 'test-request-123'
    };

    it('should handle errors without status codes', async () => {
      const error = new Error('Network error');
      mockOperation.mockRejectedValue(error);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.retryCount).toBe(0); // Should not retry without status code
    });

    it('should handle errors with response.status', async () => {
      const error = new Error('API error');
      (error as any).response = { status: 429 };
      mockOperation.mockRejectedValue(error);

      const result = await throttlingService.executeWithThrottling(
        mockOperation,
        context
      );

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3); // Should retry on 429
    });
  });
});

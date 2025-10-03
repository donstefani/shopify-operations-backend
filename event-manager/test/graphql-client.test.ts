/**
 * GraphQL Client Service Tests
 * 
 * Tests the base GraphQL client functionality including
 * query execution, error handling, and integration with throttling service.
 */

import { BaseGraphQLClient } from '../src/services/core/graphql-client.service';
import { GraphQLRequest, GraphQLClientContext, GraphQLClientConfig } from '../src/types/errors.types';

// Mock the throttling service
jest.mock('../src/services/core/throttling.service', () => ({
  throttlingService: {
    executeWithThrottling: jest.fn(),
    parseRateLimitHeaders: jest.fn()
  }
}));

// Mock the error handling service
jest.mock('../src/services/core/error-handling.service', () => ({
  errorHandlingService: {
    handleGraphQLError: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock fetch
global.fetch = jest.fn();

const mockThrottlingService = require('../src/services/core/throttling.service').throttlingService;
const mockErrorHandlingService = require('../src/services/core/error-handling.service').errorHandlingService;

describe('BaseGraphQLClient', () => {
  let graphqlClient: BaseGraphQLClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    graphqlClient = new BaseGraphQLClient();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    
    // Reset mocks
    jest.clearAllMocks();
    mockThrottlingService.executeWithThrottling.mockClear();
    mockThrottlingService.parseRateLimitHeaders.mockClear();
    mockErrorHandlingService.handleGraphQLError.mockClear();
  });

  describe('executeQuery', () => {
    const context: GraphQLClientContext = {
      shopDomain: 'test-shop.myshopify.com',
      operation: 'getProduct'
    };

    const config: GraphQLClientConfig = {
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2024-01'
    };

    it('should execute a successful query', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }',
        variables: { id: '123' }
      };

      const mockResponse = {
        data: { product: { id: '123', title: 'Test Product' } }
      };

      mockThrottlingService.executeWithThrottling.mockResolvedValue({
        success: true,
        data: mockResponse,
        retryCount: 0,
        totalDelay: 0
      });

      const result = await graphqlClient.executeQuery(request, context, config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockThrottlingService.executeWithThrottling).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          shopDomain: 'test-shop.myshopify.com',
          operation: 'query:getProduct'
        })
      );
    });

    it('should handle GraphQL errors', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "invalid") { id title } }'
      };

      const mockResponse = {
        data: null,
        errors: [
          { message: 'Product not found', path: ['product'] }
        ]
      };

      mockThrottlingService.executeWithThrottling.mockResolvedValue({
        success: true,
        data: mockResponse,
        retryCount: 0,
        totalDelay: 0
      });

      const result = await graphqlClient.executeQuery(request, context, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('GraphQL errors: Product not found');
      expect(mockErrorHandlingService.handleGraphQLError).toHaveBeenCalledWith(
        expect.any(Error),
        'getProduct',
        'test-shop.myshopify.com',
        expect.objectContaining({
          service: 'graphql-client',
          operation: 'query:getProduct'
        })
      );
    });

    it('should handle throttling failures', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      const throttlingError = new Error('Rate limit exceeded');

      mockThrottlingService.executeWithThrottling.mockResolvedValue({
        success: false,
        error: throttlingError,
        retryCount: 3,
        totalDelay: 5000
      });

      const result = await graphqlClient.executeQuery(request, context, config);

      expect(result.success).toBe(false);
      expect(result.error).toBe(throttlingError);
      expect(result.retryCount).toBe(3);
      expect(result.totalDelay).toBe(5000);
    });

    it('should parse rate limit info from extensions', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      const mockResponse = {
        data: { product: { id: '123', title: 'Test Product' } },
        extensions: {
          cost: {
            requestedQueryCost: 10,
            actualQueryCost: 10,
            throttleStatus: {
              maximumAvailable: 1000,
              currentlyAvailable: 990,
              restoreRate: 2
            }
          }
        }
      };

      mockThrottlingService.executeWithThrottling.mockResolvedValue({
        success: true,
        data: mockResponse,
        retryCount: 0,
        totalDelay: 0
      });

      const result = await graphqlClient.executeQuery(request, context, config);

      expect(result.success).toBe(true);
      expect(result.rateLimitInfo).toEqual({
        requestedQueryCost: 10,
        actualQueryCost: 10,
        throttleStatus: {
          maximumAvailable: 1000,
          currentlyAvailable: 990,
          restoreRate: 2
        }
      });
    });
  });

  describe('executeMutation', () => {
    const context: GraphQLClientContext = {
      shopDomain: 'test-shop.myshopify.com',
      operation: 'updateProduct'
    };

    const config: GraphQLClientConfig = {
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2024-01'
    };

    it('should execute a successful mutation', async () => {
      const request: GraphQLRequest = {
        query: 'mutation updateProduct($input: ProductInput!) { productUpdate(input: $input) { product { id title } } }',
        variables: { input: { id: '123', title: 'Updated Product' } }
      };

      const mockResponse = {
        data: { 
          productUpdate: { 
            product: { id: '123', title: 'Updated Product' } 
          } 
        }
      };

      mockThrottlingService.executeWithThrottling.mockResolvedValue({
        success: true,
        data: mockResponse,
        retryCount: 0,
        totalDelay: 0
      });

      const result = await graphqlClient.executeMutation(request, context, config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockThrottlingService.executeWithThrottling).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          shopDomain: 'test-shop.myshopify.com',
          operation: 'mutation:updateProduct'
        })
      );
    });
  });

  describe('makeGraphQLRequest', () => {
    const config: GraphQLClientConfig = {
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2024-01',
      timeout: 30000
    };

    it('should make successful HTTP request', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      const mockResponse = {
        data: { product: { id: '123', title: 'Test Product' } }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['x-shopify-api-call-limit', '40/40'],
          ['x-shopify-shop-api-call-limit', '35/40']
        ]) as any,
        json: jest.fn().mockResolvedValue(mockResponse),
        text: jest.fn(),
        blob: jest.fn(),
        arrayBuffer: jest.fn(),
        formData: jest.fn(),
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        type: 'basic',
        url: 'https://test-shop.myshopify.com/admin/api/2024-01/graphql.json',
        redirected: false,
        bytes: jest.fn()
      } as any);

      mockThrottlingService.parseRateLimitHeaders.mockReturnValue({
        requestedQueryCost: 40,
        actualQueryCost: 40,
        throttleStatus: {
          maximumAvailable: 40,
          currentlyAvailable: 35,
          restoreRate: 2
        }
      });

      // Mock the throttling service to call our function directly
      mockThrottlingService.executeWithThrottling.mockImplementation(async (operation: () => Promise<any>) => {
        const result = await operation();
        return {
          success: true,
          data: result,
          retryCount: 0,
          totalDelay: 0
        };
      });

      const result = await graphqlClient.executeQuery(request, {
        shopDomain: 'test-shop.myshopify.com',
        operation: 'getProduct'
      }, config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-shop.myshopify.com/admin/api/2024-01/graphql.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': 'test-token'
          }),
          body: JSON.stringify({
            query: request.query,
            variables: {},
            operationName: undefined
          })
        })
      );
    });

    it('should handle HTTP errors', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map() as any,
        text: jest.fn().mockResolvedValue('Unauthorized'),
        json: jest.fn(),
        blob: jest.fn(),
        arrayBuffer: jest.fn(),
        formData: jest.fn(),
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        type: 'basic',
        url: 'https://test-shop.myshopify.com/admin/api/2024-01/graphql.json',
        redirected: false,
        bytes: jest.fn()
      } as any);

      mockThrottlingService.executeWithThrottling.mockImplementation(async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (error) {
          return {
            success: false,
            error,
            retryCount: 0,
            totalDelay: 0
          };
        }
      });

      const result = await graphqlClient.executeQuery(request, {
        shopDomain: 'test-shop.myshopify.com',
        operation: 'getProduct'
      }, config);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('HTTP 401: Unauthorized');
    });

    it('should handle timeout', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      // Mock AbortController
      const mockAbortController = {
        abort: jest.fn(),
        signal: { aborted: false }
      };
      global.AbortController = jest.fn(() => mockAbortController) as any;
      global.setTimeout = jest.fn((callback) => {
        // Simulate timeout
        callback();
        return 123 as any;
      }) as any;
      global.clearTimeout = jest.fn();

      mockFetch.mockRejectedValue(new Error('Request timeout'));

      mockThrottlingService.executeWithThrottling.mockImplementation(async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (error) {
          return {
            success: false,
            error,
            retryCount: 0,
            totalDelay: 0
          };
        }
      });

      const result = await graphqlClient.executeQuery(request, {
        shopDomain: 'test-shop.myshopify.com',
        operation: 'getProduct'
      }, { ...config, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Request timeout');
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const client = new BaseGraphQLClient();
      const config = client.getConfig();
      
      expect(config.apiVersion).toBe('2024-01');
      expect(config.timeout).toBe(30000);
    });

    it('should merge custom configuration', () => {
      const customConfig = {
        apiVersion: '2023-10',
        timeout: 60000
      };
      
      const client = new BaseGraphQLClient(customConfig);
      const config = client.getConfig();
      
      expect(config.apiVersion).toBe('2023-10');
      expect(config.timeout).toBe(60000);
    });

    it('should update configuration', () => {
      const client = new BaseGraphQLClient();
      client.updateConfig({ apiVersion: '2023-07' });
      
      const config = client.getConfig();
      expect(config.apiVersion).toBe('2023-07');
    });
  });

  describe('input validation', () => {
    it('should validate GraphQL request', async () => {
      const invalidRequest = {
        query: '', // Empty query should fail validation
        variables: { id: '123' }
      } as GraphQLRequest;

      const context: GraphQLClientContext = {
        shopDomain: 'test-shop.myshopify.com',
        operation: 'getProduct'
      };

      await expect(
        graphqlClient.executeQuery(invalidRequest, context)
      ).rejects.toThrow();
    });

    it('should validate context', async () => {
      const request: GraphQLRequest = {
        query: 'query { product(id: "123") { id title } }'
      };

      const invalidContext = {
        shopDomain: '', // Empty shop domain should fail validation
        operation: 'getProduct'
      } as GraphQLClientContext;

      await expect(
        graphqlClient.executeQuery(request, invalidContext)
      ).rejects.toThrow();
    });
  });
});

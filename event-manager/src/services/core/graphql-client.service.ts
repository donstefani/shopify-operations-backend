/**
 * Base GraphQL Client Service
 * 
 * Provides a foundation for making GraphQL requests to Shopify's Admin API
 * with built-in throttling, error handling, and rate limit management.
 * This is the base class that domain-specific clients will extend.
 */

import { 
  GraphQLRequest, 
  GraphQLResponse, 
  GraphQLClientConfig, 
  GraphQLClientContext,
  IGraphQLClient,
  ThrottlingContext,
  ThrottlingResult
} from '../../types/errors.types';
import { 
  GraphQLRequestSchema, 
  GraphQLClientConfigSchema, 
  GraphQLClientContextSchema 
} from '../../schemas/validation.schemas';
import { throttlingService } from './throttling.service';
import { errorHandlingService } from './error-handling.service';

export class BaseGraphQLClient implements IGraphQLClient {
  private defaultConfig: Partial<GraphQLClientConfig>;

  constructor(config?: Partial<GraphQLClientConfig>) {
    this.defaultConfig = {
      apiVersion: '2024-01',
      timeout: 30000,
      ...config
    };
  }

  /**
   * Execute a GraphQL query with throttling and error handling
   */
  async executeQuery<T>(
    request: GraphQLRequest,
    context: GraphQLClientContext,
    config?: Partial<GraphQLClientConfig>
  ): Promise<ThrottlingResult<GraphQLResponse<T>>> {
    return this.executeGraphQLOperation<T>(request, context, config, 'query');
  }

  /**
   * Execute a GraphQL mutation with throttling and error handling
   */
  async executeMutation<T>(
    request: GraphQLRequest,
    context: GraphQLClientContext,
    config?: Partial<GraphQLClientConfig>
  ): Promise<ThrottlingResult<GraphQLResponse<T>>> {
    return this.executeGraphQLOperation<T>(request, context, config, 'mutation');
  }

  /**
   * Internal method to execute GraphQL operations with throttling
   */
  private async executeGraphQLOperation<T>(
    request: GraphQLRequest,
    context: GraphQLClientContext,
    config: Partial<GraphQLClientConfig> | undefined,
    operationType: 'query' | 'mutation'
  ): Promise<ThrottlingResult<GraphQLResponse<T>>> {
    // Validate inputs
    const validatedRequest = GraphQLRequestSchema.parse(request);
    const validatedContext = GraphQLClientContextSchema.parse(context);
    const finalConfig = this.mergeConfig(config);

    // Create throttling context
    const throttlingContext: ThrottlingContext = {
      shopDomain: validatedContext.shopDomain,
      operation: `${operationType}:${validatedContext.operation}`,
      requestId: validatedContext.requestId,
      additionalData: {
        ...validatedContext.additionalData,
        operationType,
        query: validatedRequest.query.substring(0, 100) + '...' // Truncate for logging
      }
    };

    // Execute with throttling
    const result = await throttlingService.executeWithThrottling(
      () => this.makeGraphQLRequest<T>({
        query: validatedRequest.query,
        variables: validatedRequest.variables || {},
        operationName: validatedRequest.operationName || undefined
      }, finalConfig),
      throttlingContext
    );

    // Handle GraphQL-specific errors
    if (result.success && result.data) {
      const response = result.data as GraphQLResponse<T>;
      
      // Check for GraphQL errors
      if (response.errors && response.errors.length > 0) {
        const graphqlError = new Error(`GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`);
        (graphqlError as any).graphqlErrors = response.errors;
        
        // Report GraphQL errors
        await errorHandlingService.handleGraphQLError(
          graphqlError,
          validatedContext.operation,
          validatedContext.shopDomain,
          {
            service: 'graphql-client',
            operation: `${operationType}:${validatedContext.operation}`,
            requestId: validatedContext.requestId,
            additionalData: {
              errors: response.errors,
              query: validatedRequest.query.substring(0, 200),
              variables: validatedRequest.variables
            }
          }
        );

        return {
          success: false,
          error: graphqlError,
          retryCount: result.retryCount,
          totalDelay: result.totalDelay
        };
      }

      // Parse rate limit info from extensions
      if (response.extensions?.cost) {
        result.rateLimitInfo = {
          requestedQueryCost: response.extensions.cost.requestedQueryCost,
          actualQueryCost: response.extensions.cost.actualQueryCost,
          throttleStatus: response.extensions.cost.throttleStatus
        };
      }
    }

    return result;
  }

  /**
   * Make the actual HTTP request to Shopify's GraphQL endpoint
   */
  private async makeGraphQLRequest<T>(
    request: GraphQLRequest,
    config: GraphQLClientConfig
  ): Promise<GraphQLResponse<T>> {
    const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
      'User-Agent': 'Shopify-Event-Processor/1.0.0'
    };

    const body = JSON.stringify({
      query: request.query,
      variables: request.variables || {},
      operationName: request.operationName
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json() as GraphQLResponse<T>;

      // Parse rate limit headers
      const rateLimitInfo = throttlingService.parseRateLimitHeaders(
        Object.fromEntries(response.headers.entries())
      );

      if (rateLimitInfo && responseData.extensions) {
        responseData.extensions.cost = {
          requestedQueryCost: rateLimitInfo.requestedQueryCost,
          actualQueryCost: rateLimitInfo.actualQueryCost,
          throttleStatus: rateLimitInfo.throttleStatus
        };
      }

      return responseData;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GraphQL request timeout after ${config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Merge provided config with defaults
   */
  private mergeConfig(config?: Partial<GraphQLClientConfig>): GraphQLClientConfig {
    const merged = { ...this.defaultConfig, ...config };
    return GraphQLClientConfigSchema.parse(merged) as GraphQLClientConfig;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Partial<GraphQLClientConfig> {
    return { ...this.defaultConfig };
  }

  /**
   * Update the default configuration
   */
  updateConfig(config: Partial<GraphQLClientConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// Export singleton instance
export const baseGraphQLClient = new BaseGraphQLClient();

/**
 * Throttling Service
 * 
 * Handles GraphQL rate limiting, backoff strategies, and retry logic for Shopify API calls.
 * Implements exponential backoff with jitter to handle rate limits gracefully.
 */

import { 
  ThrottlingConfig, 
  ThrottlingContext, 
  ThrottlingResult, 
  RateLimitInfo,
  IThrottlingService
} from '../../types/errors.types';
import { ThrottlingConfigSchema, ThrottlingContextSchema } from '../../schemas/validation.schemas';
import { errorHandlingService } from './error-handling.service';

export class ThrottlingService implements IThrottlingService {
  private defaultConfig: ThrottlingConfig;

  constructor(config?: Partial<ThrottlingConfig>) {
    this.defaultConfig = this.mergeWithDefaults(config);
  }

  /**
   * Execute an operation with throttling and retry logic
   */
  async executeWithThrottling<T>(
    operation: () => Promise<T>,
    context: ThrottlingContext,
    config?: Partial<ThrottlingConfig>
  ): Promise<ThrottlingResult<T>> {
    const finalConfig = this.mergeWithDefaults(config);
    const validatedContext = ThrottlingContextSchema.parse(context);
    
    let retryCount = 0;
    let totalDelay = 0;
    let lastError: Error | undefined;
    let rateLimitInfo: RateLimitInfo | undefined;

    // Validate throttling is enabled
    if (!finalConfig.enabled) {
      try {
        const data = await operation();
        return {
          success: true,
          data,
          retryCount: 0,
          totalDelay: 0
        };
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          retryCount: 0,
          totalDelay: 0
        };
      }
    }

    while (retryCount <= finalConfig.maxRetries) {
      try {
        const data = await operation();
        
        // Log successful operation
        if (retryCount > 0) {
          console.log(`✅ Operation succeeded after ${retryCount} retries: ${validatedContext.operation}`);
        }

        return {
          success: true,
          data,
          rateLimitInfo: rateLimitInfo || undefined,
          retryCount,
          totalDelay
        };

      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry this error
        if (!this.shouldRetry(lastError, retryCount, finalConfig)) {
          console.log(`❌ Not retrying error: ${lastError.message}`);
          break;
        }

        // Calculate delay for next retry
        const delay = this.calculateBackoffDelay(retryCount, finalConfig);
        totalDelay += delay;

        console.log(`⏳ Retry ${retryCount + 1}/${finalConfig.maxRetries} for ${validatedContext.operation} in ${delay}ms`);

        // Wait before retrying
        await this.sleep(delay);
        retryCount++;
      }
    }

    // All retries exhausted
    const errorMessage = `Operation failed after ${retryCount} retries: ${lastError?.message}`;
    console.error(`❌ ${errorMessage}`);

    // Report the error to error handling service
    await errorHandlingService.handleGraphQLError(
      lastError,
      validatedContext.operation,
      validatedContext.shopDomain,
      {
        service: 'throttling-service',
        operation: 'executeWithThrottling',
        requestId: validatedContext.requestId,
        additionalData: {
          retryCount,
          totalDelay,
          rateLimitInfo,
          ...validatedContext.additionalData
        }
      }
    );

    return {
      success: false,
      error: lastError || undefined,
      rateLimitInfo: rateLimitInfo || undefined,
      retryCount,
      totalDelay
    };
  }

  /**
   * Parse Shopify rate limit headers from HTTP response
   */
  parseRateLimitHeaders(headers: Record<string, string>): RateLimitInfo | null {
    try {
      const requestedQueryCost = parseInt(headers['x-shopify-api-call-limit'] || '0');
      const actualQueryCost = parseInt(headers['x-shopify-api-call-limit'] || '0');
      
      // Parse throttle status from headers
      const throttleStatusHeader = headers['x-shopify-shop-api-call-limit'];
      if (!throttleStatusHeader) {
        return null;
      }

      // Format: "40/40" (currently available / maximum available)
      const parts = throttleStatusHeader.split('/');
      const currentlyAvailable = parseInt(parts[0] || '0') || 0;
      const maximumAvailable = parseInt(parts[1] || '0') || 0;
      const restoreRate = parseInt(headers['x-shopify-api-version'] || '2'); // Default restore rate

      return {
        requestedQueryCost,
        actualQueryCost,
        throttleStatus: {
          maximumAvailable,
          currentlyAvailable,
          restoreRate: restoreRate || 2 // Default restore rate
        }
      };
    } catch (error) {
      console.warn('Failed to parse rate limit headers:', error);
      return null;
    }
  }

  /**
   * Calculate backoff delay with exponential backoff and optional jitter
   */
  calculateBackoffDelay(retryCount: number, config: ThrottlingConfig): number {
    if (retryCount === 0) {
      return 0;
    }

    // Exponential backoff: baseDelay * (backoffMultiplier ^ retryCount)
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount - 1);

    // Apply jitter to prevent thundering herd
    if (config.jitter) {
      // Add random jitter: ±25% of the delay
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }

    // Ensure delay doesn't exceed maximum
    delay = Math.min(delay, config.maxDelay);

    // Ensure delay is at least 100ms
    delay = Math.max(delay, 100);

    return Math.round(delay);
  }

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error: Error, retryCount: number, config: ThrottlingConfig): boolean {
    // Don't retry if we've exceeded max retries
    if (retryCount >= config.maxRetries) {
      return false;
    }

    // Check if error has a status code that's retryable
    const statusCode = this.extractStatusCode(error);
    if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    // Check for specific error messages that indicate rate limiting
    const errorMessage = error.message.toLowerCase();
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      'throttled',
      'quota exceeded',
      'service unavailable',
      'temporary failure',
      'timeout'
    ];

    return rateLimitIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Extract HTTP status code from error object
   */
  private extractStatusCode(error: Error): number | null {
    // Check for status property
    if ('status' in error && typeof (error as any).status === 'number') {
      return (error as any).status;
    }

    // Check for statusCode property
    if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
      return (error as any).statusCode;
    }

    // Check for response.status
    if ('response' in error && (error as any).response && 'status' in (error as any).response) {
      return (error as any).response.status;
    }

    // Try to extract from error message
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch && statusMatch[1]) {
      return parseInt(statusMatch[1]);
    }

    return null;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Merge provided config with defaults
   */
  private mergeWithDefaults(config?: Partial<ThrottlingConfig>): ThrottlingConfig {
    const merged = { ...this.defaultConfig, ...config };
    return ThrottlingConfigSchema.parse(merged);
  }
}

// Default configuration
const defaultThrottlingConfig: ThrottlingConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  respectShopifyRateLimits: true
};

// Export singleton instance
export const throttlingService = new ThrottlingService(defaultThrottlingConfig);

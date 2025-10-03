/**
 * Core Services Index
 * 
 * Central export point for all core reusable services.
 * These services provide foundational functionality used across the application.
 */

export { 
  ErrorHandlingService, 
  errorHandlingService
} from './error-handling.service';

export { 
  ThrottlingService, 
  throttlingService
} from './throttling.service';

export { 
  BaseGraphQLClient, 
  baseGraphQLClient
} from './graphql-client.service';

// Re-export types and schemas for convenience
export * from '../../types/errors.types';
export * from '../../schemas/validation.schemas';

// Future core services will be exported here:
// export { RetryService } from './retry.service.js';

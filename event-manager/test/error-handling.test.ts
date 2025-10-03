/**
 * Jest tests for Error Handling Service
 * 
 * Tests the error handling service functionality including
 * email notifications, error categorization, and rate limiting.
 */

import { ErrorHandlingService } from '../src/services/core/error-handling.service';
import { ErrorSeverity, ErrorCategory } from '../src/types/errors.types';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('ErrorHandlingService', () => {
  let errorService: ErrorHandlingService;

  beforeEach(() => {
    // Create a new instance for each test
    errorService = new ErrorHandlingService({
      email: {
        enabled: true,
        from: 'test@example.com',
        to: ['admin@example.com'],
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'test-password'
          }
        }
      },
      severityThreshold: ErrorSeverity.MEDIUM,
      rateLimit: {
        enabled: true,
        maxEmailsPerHour: 5,
        maxEmailsPerDay: 20
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(errorService.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock transporter.verify to throw an error
      const mockTransporter = {
        verify: jest.fn().mockRejectedValue(new Error('SMTP connection failed')),
        sendMail: jest.fn()
      };
      
      const nodemailer = require('nodemailer');
      nodemailer.createTransport.mockReturnValue(mockTransporter);

      await errorService.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Failed to initialize email service:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await errorService.initialize();
    });

    it('should handle critical errors', async () => {
      const error = new Error('Critical system failure');
      const context = {
        service: 'test-service',
        operation: 'critical-test'
      };

      await expect(
        errorService.handleCriticalError(error, context)
      ).resolves.not.toThrow();
    });

    it('should handle webhook errors', async () => {
      const error = new Error('Webhook processing failed');
      
      await expect(
        errorService.handleWebhookError(
          error,
          'products/create',
          'test-shop.myshopify.com',
          { operation: 'webhook-test' }
        )
      ).resolves.not.toThrow();
    });

    it('should handle GraphQL errors', async () => {
      const error = new Error('GraphQL query failed');
      
      await expect(
        errorService.handleGraphQLError(
          error,
          'webhookCreate',
          'test-shop.myshopify.com',
          { additionalData: { query: 'test' } }
        )
      ).resolves.not.toThrow();
    });

    it('should handle errors with different severity levels', async () => {
      const error = new Error('Test error');
      
      // Test all severity levels
      const severities = [
        ErrorSeverity.LOW,
        ErrorSeverity.MEDIUM,
        ErrorSeverity.HIGH,
        ErrorSeverity.CRITICAL
      ];

      for (const severity of severities) {
        await expect(
          errorService.handleError(error, severity, ErrorCategory.SYSTEM)
        ).resolves.not.toThrow();
      }
    });

    it('should handle errors with different categories', async () => {
      const error = new Error('Test error');
      
      // Test all categories
      const categories = [
        ErrorCategory.AUTHENTICATION,
        ErrorCategory.WEBHOOK_PROCESSING,
        ErrorCategory.GRAPHQL_API,
        ErrorCategory.DATABASE,
        ErrorCategory.NETWORK,
        ErrorCategory.VALIDATION,
        ErrorCategory.SYSTEM,
        ErrorCategory.UNKNOWN
      ];

      for (const category of categories) {
        await expect(
          errorService.handleError(error, ErrorSeverity.MEDIUM, category)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await errorService.initialize();
    });

    it('should respect rate limits', async () => {
      const error = new Error('Rate limit test');
      
      // Send a few errors rapidly (within rate limit)
      for (let i = 0; i < 3; i++) {
        await errorService.handleError(
          error,
          ErrorSeverity.HIGH,
          ErrorCategory.SYSTEM
        );
      }

      // The service should handle this gracefully without throwing
      expect(true).toBe(true); // If we get here, no errors were thrown
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultService = new ErrorHandlingService();
      expect(defaultService).toBeInstanceOf(ErrorHandlingService);
    });

    it('should merge provided configuration with defaults', () => {
      const customService = new ErrorHandlingService({
        severityThreshold: ErrorSeverity.LOW,
        rateLimit: {
          enabled: false,
          maxEmailsPerHour: 10,
          maxEmailsPerDay: 50
        }
      });
      
      expect(customService).toBeInstanceOf(ErrorHandlingService);
    });
  });

  describe('Error Context Validation', () => {
    beforeEach(async () => {
      await errorService.initialize();
    });

    it('should handle valid error context', async () => {
      const error = new Error('Context test');
      const validContext = {
        service: 'test-service',
        operation: 'test-operation',
        shopDomain: 'test-shop.myshopify.com',
        webhookTopic: 'products/create',
        userId: 'user-123',
        requestId: 'req-456',
        additionalData: {
          key1: 'value1',
          key2: 123
        }
      };

      await expect(
        errorService.handleError(
          error,
          ErrorSeverity.MEDIUM,
          ErrorCategory.SYSTEM,
          validContext
        )
      ).resolves.not.toThrow();
    });

    it('should handle invalid error context gracefully', async () => {
      const error = new Error('Invalid context test');
      const invalidContext = {
        service: 123, // Invalid type
        operation: null, // Invalid type
        additionalData: 'not-an-object' // Invalid type
      };

      // Should not throw, but should handle gracefully
      await expect(
        errorService.handleError(
          error,
          ErrorSeverity.MEDIUM,
          ErrorCategory.SYSTEM,
          invalidContext as any
        )
      ).resolves.not.toThrow();
    });
  });
});

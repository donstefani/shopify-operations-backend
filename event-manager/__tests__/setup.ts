/**
 * Jest Setup File for Event Manager Tests
 * 
 * This file runs before all tests to configure the testing environment.
 */

// Set test environment variables
process.env['NODE_ENV'] = 'test';

// Mock environment variables for testing
process.env['AWS_REGION'] = 'us-east-1';
process.env['SHOPIFY_API_SECRET'] = 'test-secret';

// Database configuration for tests
process.env['DB_HOST'] = 'localhost';
process.env['DB_USER'] = 'test_user';
process.env['DB_PASSWORD'] = 'test_password';
process.env['DB_NAME'] = 'test_db';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Mock fetch for API calls
global.fetch = jest.fn();


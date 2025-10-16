/**
 * Jest Setup File for Shared Package Tests
 * 
 * This file runs before all tests to configure the testing environment.
 */

// Set test environment variables
process.env['NODE_ENV'] = 'test';

// Database configuration for tests (using test database)
process.env['DB_HOST'] = 'localhost';
process.env['DB_USER'] = 'test_user';
process.env['DB_PASSWORD'] = 'test_password';
process.env['DB_NAME'] = 'test_operations_manager';
process.env['DB_PORT'] = '3306';

// Increase timeout for integration tests with database
jest.setTimeout(30000);

// Suppress console output in tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};


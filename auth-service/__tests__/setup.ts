// Global test setup and mocks
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_DYNAMODB_TABLE = 'test-shopify-auth-tokens';
process.env.SHOPIFY_CLIENT_ID = 'test-client-id';
process.env.SHOPIFY_CLIENT_SECRET = 'test-client-secret';
process.env.SHOPIFY_REDIRECT_URI = 'http://localhost:3000/auth/callback';
process.env.SHOPIFY_SCOPES = 'read_products,write_products,read_orders,read_customer';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
process.env.SESSION_SECRET = 'test-session-secret';

// Suppress console logs during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);
/**
 * Unit Tests for Database Configuration
 * 
 * Tests database configuration functions and service-specific configs
 */

import {
  DatabaseConfig,
  getDatabaseConfig,
  getEventManagerDbConfig,
  getBaseNavDbConfig,
  getCustomerManagerDbConfig,
  getOrderManagerDbConfig,
  getProductManagerDbConfig
} from '../../database/config/database.config';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDatabaseConfig', () => {
    it('should return default configuration when no env vars are set', () => {
      const config = getDatabaseConfig();

      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port', 3306);
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('username');
      expect(config).toHaveProperty('password');
      expect(config.pool).toHaveProperty('min', 2);
      expect(config.pool).toHaveProperty('max', 10);
    });

    it('should use environment variables when provided', () => {
      process.env['DB_HOST'] = 'test-host';
      process.env['DB_PORT'] = '5432';
      process.env['DB_NAME'] = 'test_db';
      process.env['DB_USERNAME'] = 'test_user';
      process.env['DB_PASSWORD'] = 'test_pass';
      process.env['DB_POOL_MIN'] = '5';
      process.env['DB_POOL_MAX'] = '20';

      const config = getDatabaseConfig();

      expect(config.host).toBe('test-host');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('test_db');
      expect(config.username).toBe('test_user');
      expect(config.password).toBe('test_pass');
      expect(config.pool?.min).toBe(5);
      expect(config.pool?.max).toBe(20);
    });

    it('should handle SSL configuration from environment', () => {
      process.env['DB_SSL'] = 'true';
      const config = getDatabaseConfig();
      expect(config.ssl).toBe(true);
    });

    it('should parse numeric env vars correctly', () => {
      process.env['DB_CONNECTION_TIMEOUT'] = '45000';
      process.env['DB_ACQUIRE_TIMEOUT'] = '30000';
      process.env['DB_IDLE_TIMEOUT'] = '15000';

      const config = getDatabaseConfig();

      expect(config.connectionTimeout).toBe(45000);
      expect(config.acquireTimeout).toBe(30000);
      expect(config.pool?.idleTimeoutMillis).toBe(15000);
    });
  });

  describe('Service-specific configurations', () => {
    it('getEventManagerDbConfig should have optimized pool settings', () => {
      const config = getEventManagerDbConfig();

      expect(config.pool?.min).toBe(1);
      expect(config.pool?.max).toBe(5);
      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('database');
    });

    it('getBaseNavDbConfig should have higher pool limits for UI', () => {
      const config = getBaseNavDbConfig();

      expect(config.pool?.min).toBe(2);
      expect(config.pool?.max).toBe(15);
    });

    it('getCustomerManagerDbConfig should have moderate pool settings', () => {
      const config = getCustomerManagerDbConfig();

      expect(config.pool?.min).toBe(2);
      expect(config.pool?.max).toBe(8);
    });

    it('getOrderManagerDbConfig should have moderate pool settings', () => {
      const config = getOrderManagerDbConfig();

      expect(config.pool?.min).toBe(2);
      expect(config.pool?.max).toBe(8);
    });

    it('getProductManagerDbConfig should have moderate pool settings', () => {
      const config = getProductManagerDbConfig();

      expect(config.pool?.min).toBe(2);
      expect(config.pool?.max).toBe(8);
    });

    it('all service configs should inherit base configuration', () => {
      process.env['DB_HOST'] = 'custom-host';
      process.env['DB_NAME'] = 'custom_db';

      const eventConfig = getEventManagerDbConfig();
      const baseNavConfig = getBaseNavDbConfig();
      const customerConfig = getCustomerManagerDbConfig();

      expect(eventConfig.host).toBe('custom-host');
      expect(baseNavConfig.host).toBe('custom-host');
      expect(customerConfig.host).toBe('custom-host');

      expect(eventConfig.database).toBe('custom_db');
      expect(baseNavConfig.database).toBe('custom_db');
      expect(customerConfig.database).toBe('custom_db');
    });
  });

  describe('Configuration validation', () => {
    it('should return valid DatabaseConfig interface', () => {
      const config: DatabaseConfig = getDatabaseConfig();

      expect(typeof config.host).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(typeof config.database).toBe('string');
      expect(typeof config.username).toBe('string');
      expect(typeof config.password).toBe('string');
    });

    it('should have valid pool configuration', () => {
      const config = getDatabaseConfig();

      expect(config.pool).toBeDefined();
      expect(config.pool?.min).toBeGreaterThanOrEqual(0);
      expect(config.pool?.max).toBeGreaterThan(config.pool?.min || 0);
      expect(config.pool?.acquireTimeoutMillis).toBeGreaterThan(0);
      expect(config.pool?.idleTimeoutMillis).toBeGreaterThan(0);
    });
  });
});


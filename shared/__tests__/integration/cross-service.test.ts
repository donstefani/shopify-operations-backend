/**
 * Integration Tests for Cross-Service Database Access
 * 
 * Tests that multiple services can use shared database utilities
 */

import { DatabaseConnection } from '../../database/connection';
import {
  getEventManagerDbConfig,
  getBaseNavDbConfig,
  getCustomerManagerDbConfig,
  getOrderManagerDbConfig,
  getProductManagerDbConfig
} from '../../database/config/database.config';

// Skip if no test database configured
const testDbAvailable = process.env['INTEGRATION_TESTS'] === 'true';
const describeIf = testDbAvailable ? describe : describe.skip;

describeIf('Cross-Service Database Access (Integration)', () => {
  afterEach(async () => {
    // Clean up - disconnect all connections
    try {
      const instance = DatabaseConnection.getInstance();
      await instance.disconnect();
    } catch (error) {
      // Ignore errors if not connected
    }
    // Reset singleton
    (DatabaseConnection as any).instance = null;
  });

  describe('Service-Specific Configurations', () => {
    it('should connect with Event Manager configuration', async () => {
      const config = getEventManagerDbConfig();
      const db = DatabaseConnection.getInstance(config);
      
      await expect(db.connect()).resolves.not.toThrow();
      
      const result = await db.queryOne('SELECT DATABASE() as current_db');
      expect(result).toHaveProperty('current_db');
      
      await db.disconnect();
    });

    it('should connect with Base Nav configuration', async () => {
      const config = getBaseNavDbConfig();
      const db = DatabaseConnection.getInstance(config);
      
      await expect(db.connect()).resolves.not.toThrow();
      await db.disconnect();
    });

    it('should connect with Customer Manager configuration', async () => {
      const config = getCustomerManagerDbConfig();
      const db = DatabaseConnection.getInstance(config);
      
      await expect(db.connect()).resolves.not.toThrow();
      await db.disconnect();
    });

    it('should connect with Order Manager configuration', async () => {
      const config = getOrderManagerDbConfig();
      const db = DatabaseConnection.getInstance(config);
      
      await expect(db.connect()).resolves.not.toThrow();
      await db.disconnect();
    });

    it('should connect with Product Manager configuration', async () => {
      const config = getProductManagerDbConfig();
      const db = DatabaseConnection.getInstance(config);
      
      await expect(db.connect()).resolves.not.toThrow();
      await db.disconnect();
    });
  });

  describe('Shared Database Access', () => {
    it('should allow different services to access the same database', async () => {
      // Simulate Event Manager accessing database
      const eventConfig = getEventManagerDbConfig();
      const eventDb = DatabaseConnection.getInstance(eventConfig);
      await eventDb.connect();
      
      const eventResult = await eventDb.queryOne('SELECT ? as service', ['event-manager']);
      expect(eventResult).toHaveProperty('service', 'event-manager');
      
      await eventDb.disconnect();
      (DatabaseConnection as any).instance = null;

      // Simulate Customer Manager accessing same database
      const customerConfig = getCustomerManagerDbConfig();
      const customerDb = DatabaseConnection.getInstance(customerConfig);
      await customerDb.connect();
      
      const customerResult = await customerDb.queryOne('SELECT ? as service', ['customer-manager']);
      expect(customerResult).toHaveProperty('service', 'customer-manager');
      
      await customerDb.disconnect();
    });

    it('should maintain separate connection pools for different services', async () => {
      const eventConfig = getEventManagerDbConfig();
      const baseNavConfig = getBaseNavDbConfig();
      
      // Event Manager has smaller pool (1-5)
      expect(eventConfig.pool?.min).toBe(1);
      expect(eventConfig.pool?.max).toBe(5);
      
      // Base Nav has larger pool (2-15)
      expect(baseNavConfig.pool?.min).toBe(2);
      expect(baseNavConfig.pool?.max).toBe(15);
    });
  });

  describe('Database Schema Information', () => {
    let db: DatabaseConnection;

    beforeAll(async () => {
      db = DatabaseConnection.getInstance();
      await db.connect();
    });

    afterAll(async () => {
      await db.disconnect();
    });

    it('should query database metadata', async () => {
      const tables = await db.queryAll(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        LIMIT 5
      `);
      
      expect(Array.isArray(tables)).toBe(true);
    });

    it('should access information_schema', async () => {
      const result = await db.queryOne(`
        SELECT SCHEMA_NAME 
        FROM information_schema.SCHEMATA 
        WHERE SCHEMA_NAME = DATABASE()
      `);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('SCHEMA_NAME');
    });

    it('should query server version', async () => {
      const result = await db.queryOne('SELECT VERSION() as version');
      
      expect(result).toHaveProperty('version');
      expect(typeof result.version).toBe('string');
      expect(result.version).toMatch(/\d+\.\d+/); // Should match version format
    });
  });

  describe('Concurrent Service Access', () => {
    it('should handle multiple service connections concurrently', async () => {
      const configs = [
        getEventManagerDbConfig(),
        getCustomerManagerDbConfig(),
        getOrderManagerDbConfig()
      ];

      const serviceNames = ['event-manager', 'customer-manager', 'order-manager'];

      // Create connections for different services
      const results = await Promise.all(
        configs.map(async (config, index) => {
          // Reset singleton for each service simulation
          (DatabaseConnection as any).instance = null;
          const db = DatabaseConnection.getInstance(config);
          await db.connect();
          
          const result = await db.queryOne('SELECT ? as service, ? as timestamp', [
            serviceNames[index],
            new Date().toISOString()
          ]);
          
          await db.disconnect();
          return result;
        })
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('service', serviceNames[index]);
        expect(result).toHaveProperty('timestamp');
      });
    });
  });
});

// Configuration validation tests (always run)
describe('Cross-Service Configuration Validation', () => {
  it('should have consistent base configuration across services', () => {
    const eventConfig = getEventManagerDbConfig();
    const customerConfig = getCustomerManagerDbConfig();
    const orderConfig = getOrderManagerDbConfig();

    // All should use same host and database
    expect(eventConfig.host).toBe(customerConfig.host);
    expect(eventConfig.host).toBe(orderConfig.host);
    expect(eventConfig.database).toBe(customerConfig.database);
    expect(eventConfig.database).toBe(orderConfig.database);
  });

  it('should have different pool configurations for different services', () => {
    const eventConfig = getEventManagerDbConfig();
    const baseNavConfig = getBaseNavDbConfig();

    // Pool sizes should be different
    expect(eventConfig.pool?.max).not.toBe(baseNavConfig.pool?.max);
  });

  it('should all inherit timeout configurations', () => {
    const configs = [
      getEventManagerDbConfig(),
      getBaseNavDbConfig(),
      getCustomerManagerDbConfig(),
      getOrderManagerDbConfig(),
      getProductManagerDbConfig()
    ];

    configs.forEach(config => {
      expect(config.connectionTimeout).toBeDefined();
      expect(config.acquireTimeout).toBeDefined();
      expect(config.pool?.acquireTimeoutMillis).toBeDefined();
      expect(config.pool?.idleTimeoutMillis).toBeDefined();
    });
  });
});


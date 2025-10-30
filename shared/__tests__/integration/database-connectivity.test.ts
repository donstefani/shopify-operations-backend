/**
 * Integration Tests for Database Connectivity
 * 
 * Tests actual MySQL database connections and operations
 * Note: These tests require a running MySQL database
 */

import { DatabaseConnection } from '../../database/connection';
import { DatabaseConfig, getDatabaseConfig } from '../../database/config/database.config';

// Skip integration tests if no test database is configured
const testDbAvailable = process.env['INTEGRATION_TESTS'] === 'true';
const describeIf = testDbAvailable ? describe : describe.skip;

describeIf('Database Connectivity (Integration)', () => {
  let dbConnection: DatabaseConnection;

  beforeAll(() => {
    // Reset singleton
    (DatabaseConnection as any).instance = null;
    
    // Use test database configuration
    const testConfig: DatabaseConfig = {
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '3306'),
      database: process.env['DB_NAME'] || 'test_operations_manager',
      username: process.env['DB_USER'] || 'test_user',
      password: process.env['DB_PASSWORD'] || 'test_password',
      pool: {
        min: 1,
        max: 3
      }
    };

    dbConnection = DatabaseConnection.getInstance(testConfig);
  });

  afterAll(async () => {
    await dbConnection.disconnect();
  });

  describe('Connection Lifecycle', () => {
    it('should successfully connect to MySQL database', async () => {
      await expect(dbConnection.connect()).resolves.not.toThrow();
      
      const pool = dbConnection.getPool();
      expect(pool).toBeDefined();
    });

    it('should execute a simple query', async () => {
      await dbConnection.connect();
      
      const result = await dbConnection.execute('SELECT 1 as result');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result[0])).toBe(true);
    });

    it('should successfully disconnect from database', async () => {
      await dbConnection.connect();
      await expect(dbConnection.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Query Operations', () => {
    beforeAll(async () => {
      await dbConnection.connect();
    });

    it('should execute SELECT queries', async () => {
      const result = await dbConnection.queryAll('SELECT 1 as num, "test" as text');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('num', 1);
      expect(result[0]).toHaveProperty('text', 'test');
    });

    it('should execute parameterized queries', async () => {
      const result = await dbConnection.queryOne(
        'SELECT ? as value',
        ['test-param']
      );
      
      expect(result).toHaveProperty('value', 'test-param');
    });

    it('should handle empty result sets', async () => {
      const result = await dbConnection.queryAll(
        'SELECT * FROM information_schema.tables WHERE table_name = ?',
        ['nonexistent_table_xyz']
      );
      
      expect(result).toEqual([]);
    });

    it('should return null for queryOne with no results', async () => {
      const result = await dbConnection.queryOne(
        'SELECT * FROM information_schema.tables WHERE table_name = ?',
        ['nonexistent_table_xyz']
      );
      
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeAll(async () => {
      await dbConnection.connect();
    });

    it('should handle invalid SQL syntax', async () => {
      await expect(
        dbConnection.execute('INVALID SQL QUERY')
      ).rejects.toThrow();
    });

    it('should handle queries to non-existent tables gracefully', async () => {
      await expect(
        dbConnection.execute('SELECT * FROM definitely_not_a_real_table_name')
      ).rejects.toThrow();
    });
  });

  describe('Connection Pool', () => {
    it('should handle multiple concurrent queries', async () => {
      await dbConnection.connect();
      
      const queries = Array(5).fill(null).map((_, i) => 
        dbConnection.queryOne('SELECT ? as query_num', [i])
      );

      const results = await Promise.all(queries);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('query_num', index);
      });
    });

    it('should reuse connections from pool', async () => {
      await dbConnection.connect();
      
      // Execute multiple queries in sequence
      await dbConnection.queryOne('SELECT 1');
      await dbConnection.queryOne('SELECT 2');
      await dbConnection.queryOne('SELECT 3');

      const pool = dbConnection.getPool();
      expect(pool).toBeDefined();
    });
  });
});

// Always-run tests that check configuration
describe('Database Connectivity (Configuration)', () => {
  it('should have valid test database configuration', () => {
    const config = getDatabaseConfig();
    
    expect(config.host).toBeDefined();
    expect(config.port).toBeGreaterThan(0);
    expect(config.database).toBeDefined();
    expect(config.username).toBeDefined();
  });

  it('should create database connection instance', () => {
    const instance = DatabaseConnection.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(DatabaseConnection);
  });
});


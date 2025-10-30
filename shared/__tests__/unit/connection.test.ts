/**
 * Unit Tests for Database Connection
 * 
 * Tests database connection pooling and query execution with mocked MySQL
 */

import { DatabaseConnection } from '../../database/connection';
import { DatabaseConfig } from '../../database/config/database.config';

// Create mock pool
const mockPool = {
  getConnection: jest.fn().mockResolvedValue({
    release: jest.fn()
  }),
  execute: jest.fn().mockResolvedValue([[], []]),
  end: jest.fn().mockResolvedValue(undefined)
};

// Mock mysql2/promise
jest.mock('mysql2/promise');

describe('DatabaseConnection', () => {
  let dbConnection: DatabaseConnection;
  const mysql = require('mysql2/promise');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (DatabaseConnection as any).instance = null;
    
    // Reset mockPool methods
    mockPool.getConnection.mockResolvedValue({
      release: jest.fn()
    });
    mockPool.execute.mockResolvedValue([[], []]);
    mockPool.end.mockResolvedValue(undefined);
    
    // Reset and configure the mysql.createPool mock
    mysql.createPool = jest.fn().mockReturnValue(mockPool);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should accept custom configuration', () => {
      const customConfig: DatabaseConfig = {
        host: 'custom-host',
        port: 3307,
        database: 'custom_db',
        username: 'custom_user',
        password: 'custom_pass',
        pool: { min: 1, max: 5 }
      };

      const instance = DatabaseConnection.getInstance(customConfig);
      expect(instance).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      dbConnection = DatabaseConnection.getInstance();
    });

    it('should create a connection pool on connect()', async () => {
      await dbConnection.connect();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number),
          user: expect.any(String),
          password: expect.any(String),
          database: expect.any(String),
          waitForConnections: true,
          connectionLimit: expect.any(Number),
          queueLimit: 0
        })
      );
    });

    it('should test connection on connect()', async () => {
      const testMockPool = {
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        }),
        execute: jest.fn(),
        end: jest.fn()
      };
      
      mysql.createPool.mockReturnValueOnce(testMockPool);

      await dbConnection.connect();

      expect(testMockPool.getConnection).toHaveBeenCalled();
    });

    it('should throw error if connection test fails', async () => {
      const failMockPool = {
        getConnection: jest.fn().mockRejectedValue(new Error('Connection failed')),
        execute: jest.fn(),
        end: jest.fn()
      };
      
      mysql.createPool.mockReturnValueOnce(failMockPool);

      await expect(dbConnection.connect()).rejects.toThrow('Connection failed');
    });

    it('should reuse existing pool on subsequent connect() calls', async () => {
      await dbConnection.connect();
      await dbConnection.connect();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
    });

    it('should close connection pool on disconnect()', async () => {
      await dbConnection.connect();
      const pool = dbConnection.getPool();

      await dbConnection.disconnect();

      expect(pool.end).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(dbConnection.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Pool Access', () => {
    beforeEach(async () => {
      dbConnection = DatabaseConnection.getInstance();
      await dbConnection.connect();
    });

    it('should return pool when connected', () => {
      const pool = dbConnection.getPool();
      expect(pool).toBeDefined();
      expect(pool).toHaveProperty('execute');
    });

    it('should throw error when getting pool before connect', () => {
      const newInstance = DatabaseConnection.getInstance();
      (newInstance as any).pool = null;

      expect(() => newInstance.getPool()).toThrow('Database not connected. Call connect() first.');
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      dbConnection = DatabaseConnection.getInstance();
      await dbConnection.connect();
    });

    it('should execute queries with parameters', async () => {
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([[], []]);

      const query = 'SELECT * FROM users WHERE id = ?';
      const params = [1];

      await dbConnection.execute(query, params);

      expect(mockPool.execute).toHaveBeenCalledWith(query, params);
    });

    it('should execute queries without parameters', async () => {
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([[], []]);

      const query = 'SELECT * FROM users';

      await dbConnection.execute(query);

      expect(mockPool.execute).toHaveBeenCalledWith(query, undefined);
    });

    it('should return first row with queryOne()', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([mockRows, []]);

      const result = await dbConnection.queryOne('SELECT * FROM users WHERE id = ?', [1]);

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should return null when queryOne() finds no rows', async () => {
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([[], []]);

      const result = await dbConnection.queryOne('SELECT * FROM users WHERE id = ?', [999]);

      expect(result).toBeNull();
    });

    it('should return all rows with queryAll()', async () => {
      const mockRows = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([mockRows, []]);

      const result = await dbConnection.queryAll('SELECT * FROM users');

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when queryAll() finds no rows', async () => {
      const mockPool = dbConnection.getPool();
      mockPool.execute = jest.fn().mockResolvedValue([[], []]);

      const result = await dbConnection.queryAll('SELECT * FROM users WHERE id > ?', [1000]);

      expect(result).toEqual([]);
    });
  });

  describe('SSL Configuration', () => {
    it('should add SSL config when ssl is enabled', async () => {
      const customConfig: DatabaseConfig = {
        host: 'secure-host',
        port: 3306,
        database: 'secure_db',
        username: 'secure_user',
        password: 'secure_pass',
        ssl: true,
        pool: { min: 1, max: 5 }
      };

      const instance = DatabaseConnection.getInstance(customConfig);
      await instance.connect();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {}
        })
      );
    });

    it('should not add SSL config when ssl is disabled', async () => {
      const customConfig: DatabaseConfig = {
        host: 'normal-host',
        port: 3306,
        database: 'normal_db',
        username: 'normal_user',
        password: 'normal_pass',
        ssl: false,
        pool: { min: 1, max: 5 }
      };

      const instance = DatabaseConnection.getInstance(customConfig);
      await instance.connect();

      const callArg = mysql.createPool.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('ssl');
    });
  });
});


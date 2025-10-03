/**
 * Shared database connection utility for operations-manager microservices
 * Provides MySQL connection pooling and management
 */

import mysql from 'mysql2/promise';
import { DatabaseConfig, getDatabaseConfig } from './config/database.config.js';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  private constructor(config?: DatabaseConfig) {
    this.config = config || getDatabaseConfig();
  }

  /**
   * Get singleton instance of DatabaseConnection
   * @param config Optional custom database configuration
   * @returns DatabaseConnection instance
   */
  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  /**
   * Establish database connection pool
   * @returns Promise<mysql.Pool> - Connected database pool
   */
  public async connect(): Promise<mysql.Pool> {
    if (!this.pool) {
      const poolConfig: any = {
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: this.config.pool?.max || 10,
        queueLimit: 0,
        acquireTimeout: this.config.acquireTimeout,
        timeout: this.config.connectionTimeout,
        reconnect: true
      };

      // Add SSL configuration if enabled
      if (this.config.ssl) {
        poolConfig.ssl = {};
      }

      this.pool = mysql.createPool(poolConfig);

      // Test the connection
      try {
        const connection = await this.pool.getConnection();
        console.log('✅ MySQL database connected successfully');
        connection.release();
      } catch (error) {
        console.error('❌ MySQL database connection failed:', error);
        throw error;
      }
    }
    return this.pool;
  }

  /**
   * Close database connection pool
   */
  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔌 MySQL database connection closed');
    }
  }

  /**
   * Get the database connection pool
   * @returns mysql.Pool - Active database pool
   * @throws Error if database not connected
   */
  public getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query with parameters
   * @param query SQL query string
   * @param params Query parameters
   * @returns Promise with query results
   */
  public async execute(query: string, params?: any[]): Promise<any> {
    const pool = this.getPool();
    return await pool.execute(query, params);
  }

  /**
   * Execute a query and return the first row
   * @param query SQL query string
   * @param params Query parameters
   * @returns Promise with first row result
   */
  public async queryOne(query: string, params?: any[]): Promise<any> {
    const pool = this.getPool();
    const [rows] = await pool.execute(query, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a query and return all rows
   * @param query SQL query string
   * @param params Query parameters
   * @returns Promise with all rows result
   */
  public async queryAll(query: string, params?: any[]): Promise<any[]> {
    const pool = this.getPool();
    const [rows] = await pool.execute(query, params);
    return Array.isArray(rows) ? rows : [];
  }
}

export default DatabaseConnection;

/**
 * Shared database configuration for operations-manager microservices
 * Provides consistent database connection settings across all services
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
    acquireTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  };
  connectionTimeout?: number;
  acquireTimeout?: number;
}

/**
 * Get base database configuration from environment variables
 * Falls back to default values for local development
 */
export const getDatabaseConfig = (): DatabaseConfig => {
  return {
    host: process.env['DB_HOST'] || 'portfolio.cfw6o02icbdk.us-east-1.rds.amazonaws.com',
    port: parseInt(process.env['DB_PORT'] || '3306'),
    database: process.env['DB_NAME'] || 'operations_manager',
    username: process.env['DB_USERNAME'] || 'admin',
    password: process.env['DB_PASSWORD'] || 'LindaLove0214$',
    ssl: process.env['DB_SSL'] === 'true',
    pool: {
      min: parseInt(process.env['DB_POOL_MIN'] || '2'),
      max: parseInt(process.env['DB_POOL_MAX'] || '10'),
      acquireTimeoutMillis: parseInt(process.env['DB_ACQUIRE_TIMEOUT'] || '60000'),
      idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000')
    },
    connectionTimeout: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '60000'),
    acquireTimeout: parseInt(process.env['DB_ACQUIRE_TIMEOUT'] || '60000')
  };
};

/**
 * Event Manager specific database configuration
 * Optimized for webhook processing workloads
 */
export const getEventManagerDbConfig = (): DatabaseConfig => {
  const config = getDatabaseConfig();
  return {
    ...config,
    pool: {
      ...config.pool,
      min: 1,  // Event manager needs fewer connections
      max: 5
    }
  };
};

/**
 * Base Nav (UI Backend) specific database configuration
 * Optimized for user interface workloads
 */
export const getBaseNavDbConfig = (): DatabaseConfig => {
  const config = getDatabaseConfig();
  return {
    ...config,
    pool: {
      ...config.pool,
      min: 2,  // UI backend needs more connections
      max: 15
    }
  };
};

/**
 * Customer Manager specific database configuration
 * Optimized for CRM workloads
 */
export const getCustomerManagerDbConfig = (): DatabaseConfig => {
  const config = getDatabaseConfig();
  return {
    ...config,
    pool: {
      ...config.pool,
      min: 2,
      max: 8
    }
  };
};

/**
 * Order Manager specific database configuration
 * Optimized for order processing workloads
 */
export const getOrderManagerDbConfig = (): DatabaseConfig => {
  const config = getDatabaseConfig();
  return {
    ...config,
    pool: {
      ...config.pool,
      min: 2,
      max: 8
    }
  };
};

/**
 * Product Manager specific database configuration
 * Optimized for product catalog workloads
 */
export const getProductManagerDbConfig = (): DatabaseConfig => {
  const config = getDatabaseConfig();
  return {
    ...config,
    pool: {
      ...config.pool,
      min: 2,
      max: 8
    }
  };
};

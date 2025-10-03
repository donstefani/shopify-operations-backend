/**
 * Shared database module exports
 * Provides database configuration and connection utilities
 */

export { DatabaseConnection } from './connection.js';
export { 
  DatabaseConfig,
  getDatabaseConfig,
  getEventManagerDbConfig,
  getBaseNavDbConfig,
  getCustomerManagerDbConfig,
  getOrderManagerDbConfig,
  getProductManagerDbConfig
} from './config/database.config.js';

export { DatabaseConnection as default } from './connection.js';

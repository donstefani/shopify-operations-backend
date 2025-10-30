-- Operations Manager Database Schema
-- This schema supports all microservices in the operations-manager system
-- Run these queries in your database client to set up the tables

-- =============================================
-- WEBHOOK EVENTS TABLE
-- =============================================
-- Stores all webhook events processed by the event-manager
CREATE TABLE IF NOT EXISTS webhook_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_domain VARCHAR(255) NOT NULL COMMENT 'Shop domain (e.g., mystore.myshopify.com)',
  topic VARCHAR(100) NOT NULL COMMENT 'Webhook topic (e.g., products/create, orders/paid)',
  event_data JSON NOT NULL COMMENT 'Full webhook event payload as JSON',
  processed_at TIMESTAMP NOT NULL COMMENT 'When the webhook was processed',
  status ENUM('pending', 'processed', 'failed') DEFAULT 'pending' COMMENT 'Processing status',
  error_message TEXT NULL COMMENT 'Error message if processing failed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  -- Indexes for performance
  INDEX idx_shop_domain (shop_domain),
  INDEX idx_topic (topic),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_processed_at (processed_at),
  INDEX idx_shop_topic (shop_domain, topic),
  INDEX idx_shop_status (shop_domain, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Webhook events processed by the event-manager microservice';

-- =============================================
-- REGISTERED WEBHOOKS TABLE
-- =============================================
-- Stores webhooks registered with Shopify via the webhook management API
CREATE TABLE IF NOT EXISTS registered_webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_domain VARCHAR(255) NOT NULL COMMENT 'Shop domain (e.g., mystore.myshopify.com)',
  topic VARCHAR(100) NOT NULL COMMENT 'Webhook topic (e.g., products/create, orders/paid)',
  webhook_url VARCHAR(500) NOT NULL COMMENT 'Webhook endpoint URL',
  webhook_id BIGINT NOT NULL COMMENT 'Shopify webhook ID',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Webhook status',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  -- Ensure unique webhook per shop/topic combination
  UNIQUE KEY unique_shop_topic (shop_domain, topic),
  INDEX idx_shop_domain (shop_domain),
  INDEX idx_status (status),
  INDEX idx_webhook_id (webhook_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Webhooks registered with Shopify via webhook management API';

-- =============================================
-- PRODUCTS TABLE (Future use)
-- =============================================
-- Stores product data extracted from webhook events
-- This will be used by product-manager microservice
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shopify_id BIGINT NOT NULL COMMENT 'Shopify product ID',
  shop_domain VARCHAR(255) NOT NULL COMMENT 'Shop domain',
  title VARCHAR(500) NOT NULL COMMENT 'Product title',
  handle VARCHAR(255) NOT NULL COMMENT 'Product handle (URL slug)',
  vendor VARCHAR(255) NULL COMMENT 'Product vendor',
  product_type VARCHAR(255) NULL COMMENT 'Product type',
  tags TEXT NULL COMMENT 'Product tags (comma-separated)',
  price DECIMAL(10,2) NULL COMMENT 'Product price from first variant',
  inventory_quantity INT NULL COMMENT 'Inventory quantity from first variant',
  status ENUM('active', 'archived', 'draft') DEFAULT 'active' COMMENT 'Product status',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  -- Indexes for performance
  UNIQUE KEY unique_shopify_product (shop_domain, shopify_id),
  INDEX idx_shop_domain (shop_domain),
  INDEX idx_handle (handle),
  INDEX idx_vendor (vendor),
  INDEX idx_product_type (product_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Product catalog data extracted from Shopify webhooks';

-- =============================================
-- ORDERS TABLE (Future use)
-- =============================================
-- Stores order data extracted from webhook events
-- This will be used by order-manager microservice
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shopify_id BIGINT NOT NULL COMMENT 'Shopify order ID',
  shop_domain VARCHAR(255) NOT NULL COMMENT 'Shop domain',
  order_number VARCHAR(50) NOT NULL COMMENT 'Order number',
  customer_id BIGINT NULL COMMENT 'Customer ID',
  customer_email VARCHAR(255) NULL COMMENT 'Customer email',
  total_price DECIMAL(10,2) NOT NULL COMMENT 'Order total price',
  currency VARCHAR(3) NOT NULL COMMENT 'Order currency code',
  status VARCHAR(50) NOT NULL COMMENT 'Order status',
  fulfillment_status VARCHAR(50) NULL COMMENT 'Fulfillment status',
  financial_status VARCHAR(50) NULL COMMENT 'Financial status',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  -- Indexes for performance
  UNIQUE KEY unique_shopify_order (shop_domain, shopify_id),
  INDEX idx_shop_domain (shop_domain),
  INDEX idx_order_number (order_number),
  INDEX idx_customer_id (customer_id),
  INDEX idx_customer_email (customer_email),
  INDEX idx_status (status),
  INDEX idx_fulfillment_status (fulfillment_status),
  INDEX idx_financial_status (financial_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Order data extracted from Shopify webhooks';

-- =============================================
-- CUSTOMERS TABLE (Future use)
-- =============================================
-- Stores customer data extracted from webhook events
-- This will be used by customer-manager microservice
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shopify_id BIGINT NOT NULL COMMENT 'Shopify customer ID',
  shop_domain VARCHAR(255) NOT NULL COMMENT 'Shop domain',
  email VARCHAR(255) NOT NULL COMMENT 'Customer email',
  first_name VARCHAR(255) NULL COMMENT 'Customer first name',
  last_name VARCHAR(255) NULL COMMENT 'Customer last name',
  phone VARCHAR(50) NULL COMMENT 'Customer phone number',
  total_spent DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total amount spent by customer',
  orders_count INT DEFAULT 0 COMMENT 'Number of orders placed',
  state ENUM('disabled', 'invited', 'enabled', 'declined') DEFAULT 'enabled' COMMENT 'Customer state',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  -- Indexes for performance
  UNIQUE KEY unique_shopify_customer (shop_domain, shopify_id),
  INDEX idx_shop_domain (shop_domain),
  INDEX idx_email (email),
  INDEX idx_state (state),
  INDEX idx_total_spent (total_spent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Customer data extracted from Shopify webhooks';

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Uncomment these to insert sample data for testing:

-- INSERT INTO webhook_events (shop_domain, topic, event_data, processed_at, status) 
-- VALUES (
--   'don-stefani-demo-store.myshopify.com',
--   'products/create',
--   '{"id": 123456789, "title": "Test Product", "handle": "test-product"}',
--   NOW(),
--   'processed'
-- );

-- INSERT INTO registered_webhooks (shop_domain, topic, webhook_url, webhook_id, status)
-- VALUES (
--   'don-stefani-demo-store.myshopify.com',
--   'products/create',
--   'https://hnochokxcd.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/create',
--   987654321,
--   'active'
-- );

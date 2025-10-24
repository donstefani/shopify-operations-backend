#!/usr/bin/env node

/**
 * Create Sample Orders Script
 * 
 * This script creates realistic sample orders in the DynamoDB table
 * to make the UI more impressive with actual data.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const SHOP_DOMAIN = 'don-stefani-demo-store.myshopify.com';
const TABLE_NAME = 'operations-event-manager-orders-dev';
const REGION = 'us-east-1';

// Initialize DynamoDB client
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// Sample order data
const sampleOrders = [
  {
    shopify_order_id: '1001',
    order_name: '#1001',
    order_number: 1001,
    email: 'sarah.johnson@email.com',
    phone: '+1-555-0123',
    total_price: '89.99',
    subtotal_price: '79.99',
    total_tax: '8.00',
    total_discounts: '0.00',
    total_line_items_price: '79.99',
    current_total_price: '89.99',
    current_total_tax: '8.00',
    currency: 'USD',
    presentment_currency: 'USD',
    financial_status: 'PAID',
    fulfillment_status: 'FULFILLED',
    processing_method: 'direct',
    gateway: 'shopify_payments',
    source_name: 'web',
    line_items: [
      {
        id: 1,
        title: 'Premium Wireless Headphones',
        quantity: 1,
        price: '79.99',
        sku: 'PWH-001',
        variant_title: 'Black',
        fulfillment_status: 'fulfilled'
      }
    ],
    shipping_lines: [
      {
        id: 1,
        title: 'Standard Shipping',
        price: '9.99',
        code: 'standard'
      }
    ],
    discount_codes: [],
    customer_data: {
      id: 1001,
      email: 'sarah.johnson@email.com',
      first_name: 'Sarah',
      last_name: 'Johnson',
      orders_count: 3,
      total_spent: '245.97'
    },
    customer_id: `${SHOP_DOMAIN}#1001`,
    shipping_address: {
      first_name: 'Sarah',
      last_name: 'Johnson',
      address1: '123 Main Street',
      city: 'New York',
      province: 'NY',
      country: 'United States',
      zip: '10001',
      phone: '+1-555-0123'
    },
    billing_address: {
      first_name: 'Sarah',
      last_name: 'Johnson',
      address1: '123 Main Street',
      city: 'New York',
      province: 'NY',
      country: 'United States',
      zip: '10001',
      phone: '+1-555-0123'
    },
    note: 'Please leave package at front door if no answer.',
    tags: ['vip-customer', 'electronics'],
    buyer_accepts_marketing: true,
    confirmed: true,
    taxes_included: false,
    test: false,
    created_at: '2025-10-20T14:30:00Z',
    updated_at: '2025-10-20T16:45:00Z',
    processed_at: '2025-10-20T14:35:00Z'
  },
  {
    shopify_order_id: '1002',
    order_name: '#1002',
    order_number: 1002,
    email: 'mike.chen@email.com',
    phone: '+1-555-0456',
    total_price: '156.50',
    subtotal_price: '140.00',
    total_tax: '14.00',
    total_discounts: '15.00',
    total_line_items_price: '155.00',
    current_total_price: '156.50',
    current_total_tax: '14.00',
    currency: 'USD',
    presentment_currency: 'USD',
    financial_status: 'PAID',
    fulfillment_status: 'PARTIAL',
    processing_method: 'direct',
    gateway: 'shopify_payments',
    source_name: 'mobile_app',
    line_items: [
      {
        id: 2,
        title: 'Smart Fitness Tracker',
        quantity: 1,
        price: '99.99',
        sku: 'SFT-002',
        variant_title: 'Blue',
        fulfillment_status: 'fulfilled'
      },
      {
        id: 3,
        title: 'Wireless Charging Pad',
        quantity: 1,
        price: '55.01',
        sku: 'WCP-003',
        variant_title: 'White',
        fulfillment_status: 'pending'
      }
    ],
    shipping_lines: [
      {
        id: 2,
        title: 'Express Shipping',
        price: '19.99',
        code: 'express'
      }
    ],
    discount_codes: [
      {
        code: 'WELCOME10',
        amount: '15.00',
        type: 'percentage'
      }
    ],
    customer_data: {
      id: 1002,
      email: 'mike.chen@email.com',
      first_name: 'Mike',
      last_name: 'Chen',
      orders_count: 1,
      total_spent: '156.50'
    },
    customer_id: `${SHOP_DOMAIN}#1002`,
    shipping_address: {
      first_name: 'Mike',
      last_name: 'Chen',
      address1: '456 Oak Avenue',
      address2: 'Apt 2B',
      city: 'Los Angeles',
      province: 'CA',
      country: 'United States',
      zip: '90210',
      phone: '+1-555-0456'
    },
    billing_address: {
      first_name: 'Mike',
      last_name: 'Chen',
      address1: '456 Oak Avenue',
      address2: 'Apt 2B',
      city: 'Los Angeles',
      province: 'CA',
      country: 'United States',
      zip: '90210',
      phone: '+1-555-0456'
    },
    note: '',
    tags: ['new-customer', 'fitness'],
    buyer_accepts_marketing: false,
    confirmed: true,
    taxes_included: false,
    test: false,
    created_at: '2025-10-21T09:15:00Z',
    updated_at: '2025-10-21T11:20:00Z',
    processed_at: '2025-10-21T09:20:00Z'
  },
  {
    shopify_order_id: '1003',
    order_name: '#1003',
    order_number: 1003,
    email: 'emma.wilson@email.com',
    phone: '+1-555-0789',
    total_price: '299.97',
    subtotal_price: '249.99',
    total_tax: '25.00',
    total_discounts: '0.00',
    total_line_items_price: '249.99',
    current_total_price: '299.97',
    current_total_tax: '25.00',
    currency: 'USD',
    presentment_currency: 'USD',
    financial_status: 'PENDING',
    fulfillment_status: 'UNFULFILLED',
    processing_method: 'direct',
    gateway: 'shopify_payments',
    source_name: 'web',
    line_items: [
      {
        id: 4,
        title: 'Professional Camera Lens',
        quantity: 1,
        price: '199.99',
        sku: 'PCL-004',
        variant_title: '50mm f/1.8',
        fulfillment_status: 'pending'
      },
      {
        id: 5,
        title: 'Camera Lens Filter Kit',
        quantity: 1,
        price: '50.00',
        sku: 'CLF-005',
        variant_title: 'UV Protection Set',
        fulfillment_status: 'pending'
      }
    ],
    shipping_lines: [
      {
        id: 3,
        title: 'Free Shipping',
        price: '0.00',
        code: 'free'
      }
    ],
    discount_codes: [],
    customer_data: {
      id: 1003,
      email: 'emma.wilson@email.com',
      first_name: 'Emma',
      last_name: 'Wilson',
      orders_count: 7,
      total_spent: '1,234.56'
    },
    customer_id: `${SHOP_DOMAIN}#1003`,
    shipping_address: {
      first_name: 'Emma',
      last_name: 'Wilson',
      address1: '789 Pine Street',
      city: 'Seattle',
      province: 'WA',
      country: 'United States',
      zip: '98101',
      phone: '+1-555-0789'
    },
    billing_address: {
      first_name: 'Emma',
      last_name: 'Wilson',
      address1: '789 Pine Street',
      city: 'Seattle',
      province: 'WA',
      country: 'United States',
      zip: '98101',
      phone: '+1-555-0789'
    },
    note: 'Gift wrapping requested for camera lens.',
    tags: ['photography', 'professional', 'high-value'],
    buyer_accepts_marketing: true,
    confirmed: false,
    taxes_included: false,
    test: false,
    created_at: '2025-10-22T16:45:00Z',
    updated_at: '2025-10-22T16:45:00Z',
    processed_at: null
  },
  {
    shopify_order_id: '1004',
    order_name: '#1004',
    order_number: 1004,
    email: 'david.rodriguez@email.com',
    phone: '+1-555-0321',
    total_price: '45.99',
    subtotal_price: '39.99',
    total_tax: '4.00',
    total_discounts: '5.00',
    total_line_items_price: '44.99',
    current_total_price: '45.99',
    current_total_tax: '4.00',
    currency: 'USD',
    presentment_currency: 'USD',
    financial_status: 'REFUNDED',
    fulfillment_status: 'FULFILLED',
    processing_method: 'direct',
    gateway: 'shopify_payments',
    source_name: 'web',
    line_items: [
      {
        id: 6,
        title: 'Bluetooth Speaker',
        quantity: 1,
        price: '39.99',
        sku: 'BS-006',
        variant_title: 'Portable Mini',
        fulfillment_status: 'fulfilled'
      }
    ],
    shipping_lines: [
      {
        id: 4,
        title: 'Standard Shipping',
        price: '6.99',
        code: 'standard'
      }
    ],
    discount_codes: [
      {
        code: 'SAVE5',
        amount: '5.00',
        type: 'fixed_amount'
      }
    ],
    customer_data: {
      id: 1004,
      email: 'david.rodriguez@email.com',
      first_name: 'David',
      last_name: 'Rodriguez',
      orders_count: 2,
      total_spent: '89.98'
    },
    customer_id: `${SHOP_DOMAIN}#1004`,
    shipping_address: {
      first_name: 'David',
      last_name: 'Rodriguez',
      address1: '321 Elm Street',
      city: 'Miami',
      province: 'FL',
      country: 'United States',
      zip: '33101',
      phone: '+1-555-0321'
    },
    billing_address: {
      first_name: 'David',
      last_name: 'Rodriguez',
      address1: '321 Elm Street',
      city: 'Miami',
      province: 'FL',
      country: 'United States',
      zip: '33101',
      phone: '+1-555-0321'
    },
    note: 'Customer requested refund due to product defect.',
    tags: ['refunded', 'electronics', 'customer-service'],
    buyer_accepts_marketing: false,
    confirmed: true,
    taxes_included: false,
    test: false,
    created_at: '2025-10-19T11:20:00Z',
    updated_at: '2025-10-23T14:30:00Z',
    processed_at: '2025-10-19T11:25:00Z',
    closed_at: '2025-10-23T14:30:00Z'
  },
  {
    shopify_order_id: '1005',
    order_name: '#1005',
    order_number: 1005,
    email: 'lisa.patel@email.com',
    phone: '+1-555-0654',
    total_price: '78.50',
    subtotal_price: '65.00',
    total_tax: '6.50',
    total_discounts: '0.00',
    total_line_items_price: '65.00',
    current_total_price: '78.50',
    current_total_tax: '6.50',
    currency: 'USD',
    presentment_currency: 'USD',
    financial_status: 'PAID',
    fulfillment_status: 'FULFILLED',
    processing_method: 'direct',
    gateway: 'shopify_payments',
    source_name: 'pos',
    line_items: [
      {
        id: 7,
        title: 'Organic Skincare Set',
        quantity: 1,
        price: '45.00',
        sku: 'OSS-007',
        variant_title: 'Sensitive Skin',
        fulfillment_status: 'fulfilled'
      },
      {
        id: 8,
        title: 'Face Moisturizer',
        quantity: 1,
        price: '20.00',
        sku: 'FM-008',
        variant_title: 'Hydrating Formula',
        fulfillment_status: 'fulfilled'
      }
    ],
    shipping_lines: [
      {
        id: 5,
        title: 'Standard Shipping',
        price: '7.50',
        code: 'standard'
      }
    ],
    discount_codes: [],
    customer_data: {
      id: 1005,
      email: 'lisa.patel@email.com',
      first_name: 'Lisa',
      last_name: 'Patel',
      orders_count: 4,
      total_spent: '312.50'
    },
    customer_id: `${SHOP_DOMAIN}#1005`,
    shipping_address: {
      first_name: 'Lisa',
      last_name: 'Patel',
      address1: '654 Maple Drive',
      city: 'Austin',
      province: 'TX',
      country: 'United States',
      zip: '73301',
      phone: '+1-555-0654'
    },
    billing_address: {
      first_name: 'Lisa',
      last_name: 'Patel',
      address1: '654 Maple Drive',
      city: 'Austin',
      province: 'TX',
      country: 'United States',
      zip: '73301',
      phone: '+1-555-0654'
    },
    note: 'In-store pickup completed.',
    tags: ['beauty', 'organic', 'in-store-pickup'],
    buyer_accepts_marketing: true,
    confirmed: true,
    taxes_included: false,
    test: false,
    created_at: '2025-10-18T13:10:00Z',
    updated_at: '2025-10-18T15:30:00Z',
    processed_at: '2025-10-18T13:15:00Z'
  }
];

/**
 * Generate composite key for order
 */
function generateOrderKey(shopDomain, orderId) {
  return `${shopDomain}#${orderId}`;
}

/**
 * Create a sample order in DynamoDB
 */
async function createSampleOrder(orderData) {
  try {
    const shop_order_id = generateOrderKey(SHOP_DOMAIN, orderData.shopify_order_id);
    
    const item = {
      shop_order_id,
      shop_domain: SHOP_DOMAIN,
      ...orderData,
      updated_at: new Date().toISOString()
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    });

    await client.send(command);
    
    console.log(`✅ Created order: ${orderData.order_name} - $${orderData.total_price} (${orderData.financial_status})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create order ${orderData.order_name}:`, error.message);
    return false;
  }
}

/**
 * Main function to create all sample orders
 */
async function main() {
  console.log('🛒 Creating Sample Orders');
  console.log('============================================================');
  console.log(`Shop: ${SHOP_DOMAIN}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}`);
  console.log('============================================================\n');

  let successCount = 0;
  let totalCount = sampleOrders.length;

  for (const order of sampleOrders) {
    const success = await createSampleOrder(order);
    if (success) successCount++;
  }

  console.log('\n============================================================');
  console.log('📊 Summary');
  console.log('============================================================');
  console.log(`✅ Successfully created: ${successCount}/${totalCount} orders`);
  console.log(`❌ Failed: ${totalCount - successCount}/${totalCount} orders`);

  if (successCount > 0) {
    console.log('\n🎉 Sample orders created successfully!');
    console.log('💡 You can now view these orders in your UI dashboard.');
  }

  console.log('\n============================================================');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createSampleOrder, sampleOrders };

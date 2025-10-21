// test-webhooks.js

const axios = require('axios');

// Configuration
const config = {
  // AWS deployment URL
  AWS_URL: 'https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev',
  
  // For local testing with serverless-offline
  LOCAL_URL: 'http://localhost:3001',
  
  // Your Shopify shop domain
  SHOP_DOMAIN: 'don-stefani-demo-store.myshopify.com',
};

// Use AWS or LOCAL based on environment variable
// Default to AWS if not specified
const BASE_URL = process.env.TEST_ENV === 'local' ? config.LOCAL_URL : config.AWS_URL;

console.log(`🧪 Testing webhooks on: ${BASE_URL}\n`);

// Sample webhook payloads matching Shopify's webhook structure
const samplePayloads = {
  'products/create': {
    id: 8765432109876,
    title: 'Test Product from Webhook Test',
    vendor: 'Test Vendor',
    product_type: 'Test Type',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    tags: 'test, webhook',
    variants: [
      {
        id: 44556677889900,
        product_id: 8765432109876,
        title: 'Default Title',
        price: '29.99',
        sku: 'TEST-SKU-001',
        inventory_quantity: 100,
        inventory_management: 'shopify',
      }
    ],
    image: {
      id: 9988776655,
      product_id: 8765432109876,
      src: 'https://example.com/test-image.jpg',
    }
  },
  
  'products/update': {
    id: 8765432109876,
    title: 'Updated Test Product',
    vendor: 'Test Vendor Updated',
    product_type: 'Test Type',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updated_at: new Date().toISOString(),
    status: 'active',
    tags: 'test, webhook, updated',
    variants: [
      {
        id: 44556677889900,
        product_id: 8765432109876,
        title: 'Default Title',
        price: '39.99', // Price updated
        sku: 'TEST-SKU-001',
        inventory_quantity: 75, // Inventory updated
        inventory_management: 'shopify',
      }
    ],
  },
  
  'orders/create': {
    id: 9988776655443,
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    number: 1001,
    note: 'Test order from webhook test',
    total_price: '59.99',
    subtotal_price: '49.99',
    total_tax: '5.00',
    total_discounts: '0.00',
    currency: 'USD',
    financial_status: 'paid',
    fulfillment_status: null,
    customer: {
      id: 5544332211009,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'Customer',
      orders_count: 1,
      total_spent: '59.99',
    },
    billing_address: {
      first_name: 'Test',
      last_name: 'Customer',
      address1: '123 Test St',
      city: 'Test City',
      province: 'California',
      country: 'United States',
      zip: '12345',
    },
    shipping_address: {
      first_name: 'Test',
      last_name: 'Customer',
      address1: '123 Test St',
      city: 'Test City',
      province: 'California',
      country: 'United States',
      zip: '12345',
    },
    line_items: [
      {
        id: 1122334455667,
        product_id: 8765432109876,
        variant_id: 44556677889900,
        title: 'Test Product',
        quantity: 2,
        price: '24.99',
        total_discount: '0.00',
        sku: 'TEST-SKU-001',
      }
    ],
  },
  
  'customers/create': {
    id: 5544332211009,
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    first_name: 'Test',
    last_name: 'Customer',
    orders_count: 0,
    state: 'enabled',
    total_spent: '0.00',
    verified_email: true,
    phone: '+1-555-123-4567',
    accepts_marketing: true,
    tags: 'test, webhook',
    addresses: [
      {
        id: 1234567890,
        customer_id: 5544332211009,
        first_name: 'Test',
        last_name: 'Customer',
        address1: '123 Test St',
        city: 'Test City',
        province: 'California',
        province_code: 'CA',
        country: 'United States',
        country_code: 'US',
        zip: '12345',
        default: true,
      }
    ],
  },
  
  'customers/update': {
    id: 5544332211009,
    email: 'test.updated@example.com', // Email updated
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    first_name: 'Test',
    last_name: 'Customer Updated', // Name updated
    orders_count: 2, // Order count updated
    state: 'enabled',
    total_spent: '119.98',
    verified_email: true,
    phone: '+1-555-123-4567',
    accepts_marketing: true,
    tags: 'test, webhook, updated',
    addresses: [
      {
        id: 1234567890,
        customer_id: 5544332211009,
        first_name: 'Test',
        last_name: 'Customer Updated',
        address1: '123 Test St',
        city: 'Test City',
        province: 'California',
        province_code: 'CA',
        country: 'United States',
        country_code: 'US',
        zip: '12345',
        default: true,
      }
    ],
  }
};

// Helper function to test a webhook endpoint
async function testWebhook(topic, payload) {
  const [mainTopic, action] = topic.split('/');
  const url = action 
    ? `${BASE_URL}/webhooks/${mainTopic}/${action}`
    : `${BASE_URL}/webhooks/${mainTopic}`;
    
  console.log(`\n📬 Testing: ${topic}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': config.SHOP_DOMAIN,
        'X-Shopify-Topic': topic,
        'X-Shopify-Webhook-Id': `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
      timeout: 15000, // 15 second timeout for AWS Lambda cold starts
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Status: ${error.response.status}`);
      console.log(`❌ Error:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log(`❌ No response received`);
      console.log(`❌ Error:`, error.message);
    } else {
      console.log(`❌ Error:`, error.message);
    }
    return { success: false, error: error.message };
  }
}

// Test health endpoint
async function testHealth() {
  console.log(`\n🏥 Testing Health Endpoint`);
  console.log(`📍 URL: ${BASE_URL}/health`);
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 10000 });
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ Health check failed:`, error.message);
    if (error.response) {
      console.log(`❌ Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Webhook Tests');
  console.log('=' .repeat(60));
  console.log(`Environment: ${process.env.TEST_ENV === 'local' ? 'LOCAL' : 'AWS'}`);
  console.log(`Shop Domain: ${config.SHOP_DOMAIN}`);
  console.log('=' .repeat(60));
  
  // Test health endpoint first
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n⚠️  Health check failed. Service may not be running.');
    console.log('Continuing with webhook tests anyway...');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing Webhook Endpoints');
  console.log('='.repeat(60));
  
  // Test each webhook type
  const results = [];
  
  for (const [topic, payload] of Object.entries(samplePayloads)) {
    const result = await testWebhook(topic, payload);
    results.push({ topic, ...result });
    
    // Small delay between requests to avoid throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (successful > 0) {
    console.log('\nSuccessful tests:');
    results.filter(r => r.success).forEach(r => {
      console.log(`  ✅ ${r.topic}`);
    });
  }
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.topic}: ${r.error}`);
    });
  }
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check DynamoDB tables to verify data was stored');
    console.log('   2. Review CloudWatch logs for processing details');
    console.log('   3. Test with real Shopify webhooks');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check CloudWatch logs in AWS Console');
    console.log('   2. Verify environment variables are set correctly');
    console.log('   3. Ensure DynamoDB tables exist and have proper permissions');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
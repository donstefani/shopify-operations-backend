const axios = require('axios');

const BASE_URL = 'https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev';

// Helper function to make requests and log responses
async function testEndpoint(method, endpoint, data = null) {
  try {
    console.log(`\n🔍 Testing ${method} ${endpoint}`);
    console.log('─'.repeat(50));
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || 'Connection Error'}`);
    if (error.response?.data) {
      console.log(`📄 Error Response:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`📄 Error Message:`, error.message);
    }
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Auth Service Endpoint Tests');
  console.log('='.repeat(60));
  
  // Test 1: Health Check
  await testEndpoint('GET', '/health');
  
  // Test 2: OAuth Initiation
  await testEndpoint('GET', '/auth/shopify?shop=don-stefani-demo-store.myshopify.com');
  
  // Test 3: Auth Status (before authentication)
  await testEndpoint('GET', '/auth/status');
  
  // Test 4: Get Token (should fail without auth)
  await testEndpoint('GET', '/auth/token');
  
  // Test 5: Logout (should work even without auth)
  await testEndpoint('POST', '/auth/logout');
  
  // Test 6: Invalid Route (should return 404)
  await testEndpoint('GET', '/invalid-route');
  
  // Test 7: OAuth Callback (should fail without proper parameters)
  await testEndpoint('GET', '/auth/shopify/callback');
  
  // Test 8: OAuth Callback with invalid parameters
  await testEndpoint('GET', '/auth/shopify/callback?code=invalid&state=invalid&shop=invalid');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
}

// Run the tests
runTests().catch(console.error);

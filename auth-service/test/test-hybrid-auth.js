const axios = require('axios');

const BASE_URL = 'https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev';

// Helper function to make requests with session cookies
async function makeRequest(method, endpoint, data = null, cookies = '') {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { 
      success: true, 
      data: response.data, 
      cookies: response.headers['set-cookie'] || []
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      cookies: error.response?.headers['set-cookie'] || []
    };
  }
}

// Test the hybrid authentication approach
async function testHybridAuth() {
  console.log('🚀 Testing Hybrid Authentication Approach');
  console.log('='.repeat(60));
  
  let cookies = '';
  
  // Step 1: Initiate OAuth (this sets the session with state)
  console.log('\n📊 Step 1: OAuth Initiation');
  const initResult = await makeRequest('GET', '/auth/shopify?shop=don-stefani-demo-store.myshopify.com', null, cookies);
  
  if (!initResult.success) {
    console.log('❌ OAuth initiation failed:', initResult.error);
    return;
  }
  
  console.log('✅ OAuth initiation successful');
  console.log('📄 Response:', JSON.stringify(initResult.data, null, 2));
  
  // Extract cookies from response
  if (initResult.cookies && initResult.cookies.length > 0) {
    cookies = initResult.cookies.map(cookie => cookie.split(';')[0]).join('; ');
    console.log('🍪 Session cookies:', cookies);
  }
  
  // Step 2: Check auth status (should be false initially)
  console.log('\n📊 Step 2: Check Initial Auth Status');
  const statusResult = await makeRequest('GET', '/auth/status', null, cookies);
  console.log('📄 Auth Status:', JSON.stringify(statusResult.data, null, 2));
  
  // Step 3: Simulate OAuth callback with valid state
  console.log('\n📊 Step 3: Simulate OAuth Callback');
  const callbackResult = await makeRequest('GET', '/auth/shopify/callback?code=test_code&state=valid_state&shop=don-stefani-demo-store.myshopify.com', null, cookies);
  console.log('📄 Callback Result:', JSON.stringify(callbackResult.data, null, 2));
  
  // Update cookies if new ones were set
  if (callbackResult.cookies && callbackResult.cookies.length > 0) {
    cookies = callbackResult.cookies.map(cookie => cookie.split(';')[0]).join('; ');
    console.log('🍪 Updated cookies:', cookies);
  }
  
  // Step 4: Check auth status after callback (should be true)
  console.log('\n📊 Step 4: Check Auth Status After Callback');
  const finalStatusResult = await makeRequest('GET', '/auth/status', null, cookies);
  console.log('📄 Final Auth Status:', JSON.stringify(finalStatusResult.data, null, 2));
  
  // Step 5: Test token retrieval
  console.log('\n📊 Step 5: Test Token Retrieval');
  const tokenResult = await makeRequest('GET', '/auth/token', null, cookies);
  console.log('📄 Token Result:', JSON.stringify(tokenResult.data, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Hybrid authentication test completed!');
  console.log('='.repeat(60));
}

// Run the test
testHybridAuth().catch(console.error);

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
    return { success: true, data: response.data, cookies: response.headers['set-cookie'] };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      cookies: error.response?.headers['set-cookie']
    };
  }
}

// Test the complete OAuth flow
async function testOAuthFlow() {
  console.log('🚀 Testing Complete OAuth Flow');
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
  if (initResult.cookies) {
    cookies = initResult.cookies.map(cookie => cookie.split(';')[0]).join('; ');
    console.log('🍪 Session cookies:', cookies);
  }
  
  // Step 2: Check auth status (should be false)
  console.log('\n📊 Step 2: Check Auth Status');
  const statusResult = await makeRequest('GET', '/auth/status', null, cookies);
  console.log('📄 Auth Status:', JSON.stringify(statusResult.data, null, 2));
  
  // Step 3: Test callback with invalid state (should fail)
  console.log('\n📊 Step 3: Test Callback with Invalid State');
  const invalidCallbackResult = await makeRequest('GET', '/auth/shopify/callback?code=test&state=invalid&shop=don-stefani-demo-store.myshopify.com', null, cookies);
  console.log('📄 Invalid Callback Result:', JSON.stringify(invalidCallbackResult.error, null, 2));
  
  // Step 4: Test callback with valid state (should work)
  console.log('\n📊 Step 4: Test Callback with Valid State');
  const validCallbackResult = await makeRequest('GET', '/auth/shopify/callback?code=test&state=valid&shop=don-stefani-demo-store.myshopify.com', null, cookies);
  console.log('📄 Valid Callback Result:', JSON.stringify(validCallbackResult.error, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ OAuth flow test completed!');
  console.log('='.repeat(60));
}

// Run the test
testOAuthFlow().catch(console.error);

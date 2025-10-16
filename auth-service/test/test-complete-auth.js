const axios = require('axios');

const BASE_URL = 'https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev';

// Helper function to make requests and log responses
async function testEndpoint(method, endpoint, data = null, headers = {}) {
  try {
    console.log(`\n🔍 Testing ${method} ${endpoint}`);
    console.log('─'.repeat(50));
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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

// Function to extract OAuth URL and state
async function getOAuthUrl() {
  console.log('\n🚀 Getting OAuth URL for complete authentication test');
  console.log('='.repeat(60));
  
  const response = await testEndpoint('GET', '/auth/shopify?shop=don-stefani-demo-store.myshopify.com');
  
  if (response && response.data && response.data.authUrl) {
    const authUrl = response.data.authUrl;
    const url = new URL(authUrl);
    const state = url.searchParams.get('state');
    
    console.log('\n📋 OAuth Information:');
    console.log(`🔗 Auth URL: ${authUrl}`);
    console.log(`🔑 State: ${state}`);
    
    return { authUrl, state };
  }
  
  return null;
}

// Function to test authentication status
async function testAuthStatus() {
  console.log('\n🔍 Testing Authentication Status');
  console.log('─'.repeat(50));
  
  return await testEndpoint('GET', '/auth/status');
}

// Function to test token retrieval
async function testTokenRetrieval() {
  console.log('\n🔍 Testing Token Retrieval');
  console.log('─'.repeat(50));
  
  return await testEndpoint('GET', '/auth/token');
}

// Function to test logout
async function testLogout() {
  console.log('\n🔍 Testing Logout');
  console.log('─'.repeat(50));
  
  return await testEndpoint('POST', '/auth/logout');
}

// Main test function for complete OAuth flow
async function runCompleteAuthTest() {
  console.log('🚀 Starting Complete OAuth Authentication Test');
  console.log('='.repeat(60));
  
  // Step 1: Get OAuth URL
  const oauthInfo = await getOAuthUrl();
  if (!oauthInfo) {
    console.log('❌ Failed to get OAuth URL');
    return;
  }
  
  // Step 2: Test initial auth status (should be false)
  console.log('\n📊 Step 1: Initial Authentication Status');
  await testAuthStatus();
  
  // Step 3: Test token retrieval (should fail)
  console.log('\n📊 Step 2: Token Retrieval (Before Auth)');
  await testTokenRetrieval();
  
  // Step 4: Provide instructions for manual OAuth completion
  console.log('\n📋 Manual OAuth Completion Required:');
  console.log('='.repeat(60));
  console.log('To complete the OAuth flow, you need to:');
  console.log('1. Open this URL in your browser:');
  console.log(`   ${oauthInfo.authUrl}`);
  console.log('');
  console.log('2. Authorize the app in your Shopify admin');
  console.log('3. You will be redirected to the callback URL');
  console.log('4. Copy the authorization code from the callback URL');
  console.log('5. Run the callback test with the real code');
  console.log('');
  console.log('🔑 State parameter for verification:', oauthInfo.state);
  console.log('='.repeat(60));
  
  // Step 5: Test logout (should work)
  console.log('\n📊 Step 3: Logout Test');
  await testLogout();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Complete OAuth test setup completed!');
  console.log('📝 Next: Complete manual OAuth flow and test callback');
  console.log('='.repeat(60));
}

// Function to test OAuth callback with real parameters
async function testOAuthCallback(code, state, shop) {
  console.log('\n🚀 Testing OAuth Callback with Real Parameters');
  console.log('='.repeat(60));
  
  const endpoint = `/auth/shopify/callback?code=${code}&state=${state}&shop=${shop}`;
  
  const response = await testEndpoint('GET', endpoint);
  
  if (response && response.success) {
    console.log('\n🎉 OAuth Callback Successful!');
    
    // Test auth status after successful callback
    console.log('\n📊 Testing Authentication Status After Callback');
    await testAuthStatus();
    
    // Test token retrieval after successful callback
    console.log('\n📊 Testing Token Retrieval After Callback');
    await testTokenRetrieval();
  }
  
  return response;
}

// Export functions for manual testing
module.exports = {
  runCompleteAuthTest,
  testOAuthCallback,
  testAuthStatus,
  testTokenRetrieval,
  testLogout
};

// Run the complete test if this file is executed directly
if (require.main === module) {
  runCompleteAuthTest().catch(console.error);
}

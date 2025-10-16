// Simple test to check if serverless offline is working
const axios = require('axios');

async function testConnection() {
  try {
    console.log('🔍 Testing basic connection...');
    const response = await axios.get('http://localhost:3000/dev/health', {
      timeout: 5000
    });
    console.log('✅ Connection successful!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    }
  }
}

testConnection();

// delete-token.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const shopDomain = 'don-stefani-demo-store.myshopify.com';

async function deleteToken() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: 'us-east-1'
  }));

  try {
    console.log(`🗑️  Deleting old token for shop: ${shopDomain}\n`);
    
    await client.send(new DeleteCommand({
      TableName: 'portfolio-shopify-auth',
      Key: { id: `token:${shopDomain}` }
    }));

    console.log('✅ Old token deleted successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Visit the OAuth URL to get a new token with expanded scopes:');
    console.log('   https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev/auth/shopify?shop=don-stefani-demo-store.myshopify.com');
    console.log('\n2. After authorizing, verify the new scopes:');
    console.log('   node test/check-token.js');
    console.log('\n3. Re-run webhook tests:');
    console.log('   node test/test-webhooks.js');
    
  } catch (error) {
    console.error('❌ Error deleting token:', error.message);
  }
}

deleteToken();


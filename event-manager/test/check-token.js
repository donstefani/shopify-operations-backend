// check-token.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const shopDomain = 'don-stefani-demo-store.myshopify.com';

async function checkToken() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: 'us-east-1'
  }));

  try {
    const result = await client.send(new GetCommand({
      TableName: 'portfolio-shopify-auth',
      Key: { id: `token:${shopDomain}` }
    }));

    if (result.Item) {
      console.log('✅ Token found for shop:', shopDomain);
      console.log('📊 Token info:', {
        hasEncryptedToken: !!result.Item.encryptedToken,
        scopes: result.Item.scopes,
        shop: result.Item.shop,
        createdAt: result.Item.createdAt
      });
      return true;
    } else {
      console.log('❌ No token found for shop:', shopDomain);
      console.log('\n💡 You need to complete the OAuth flow first!');
      console.log('Visit: https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev/auth/shopify');
      return false;
    }
  } catch (error) {
    console.error('Error checking token:', error.message);
    return false;
  }
}

checkToken();
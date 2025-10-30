// verify-dynamodb.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const shopDomain = 'don-stefani-demo-store.myshopify.com';
const region = 'us-east-1';

const tables = {
  products: 'operations-event-manager-products-dev',
  orders: 'operations-event-manager-orders-dev',
  customers: 'operations-event-manager-customers-dev',
  webhookEvents: 'operations-event-manager-webhook-events-dev'
};

async function verifyTable(tableName, label) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  
  console.log(`\n📊 Checking ${label}...`);
  console.log(`📍 Table: ${tableName}`);
  
  try {
    const result = await client.send(new ScanCommand({
      TableName: tableName,
      Limit: 10
    }));

    if (!result.Items || result.Items.length === 0) {
      console.log(`⚠️  No items found in ${label}`);
      return { found: false, count: 0 };
    }

    console.log(`✅ Found ${result.Items.length} items`);
    
    // Show sample items
    result.Items.slice(0, 3).forEach((item, index) => {
      console.log(`\n  📦 Item ${index + 1}:`);
      
      // Show relevant fields based on table type
      if (label === 'Products') {
        console.log(`     Title: ${item.title || 'N/A'}`);
        console.log(`     Product ID: ${item.shopify_product_id || item.shop_product_id || 'N/A'}`);
        console.log(`     Shop: ${item.shop_domain || 'N/A'}`);
        console.log(`     Created: ${item.created_at || 'N/A'}`);
        console.log(`     Variants: ${item.variants?.length || 0}`);
      } else if (label === 'Orders') {
        console.log(`     Order ID: ${item.shopify_order_id || item.shop_order_id || 'N/A'}`);
        console.log(`     Email: ${item.email || 'N/A'}`);
        console.log(`     Total: ${item.total_price || 'N/A'}`);
        console.log(`     Shop: ${item.shop_domain || 'N/A'}`);
        console.log(`     Created: ${item.created_at || 'N/A'}`);
      } else if (label === 'Customers') {
        console.log(`     Customer ID: ${item.shopify_customer_id || item.shop_customer_id || 'N/A'}`);
        console.log(`     Email: ${item.email || 'N/A'}`);
        console.log(`     Name: ${item.first_name || ''} ${item.last_name || ''}`);
        console.log(`     Shop: ${item.shop_domain || 'N/A'}`);
        console.log(`     Created: ${item.created_at || 'N/A'}`);
      } else if (label === 'Webhook Events') {
        console.log(`     Event ID: ${item.event_id || 'N/A'}`);
        console.log(`     Topic: ${item.topic || 'N/A'}`);
        console.log(`     Shop: ${item.shop_domain || 'N/A'}`);
        console.log(`     Created: ${item.created_at || 'N/A'}`);
      }
    });

    if (result.Items.length > 3) {
      console.log(`\n  ... and ${result.Items.length - 3} more items`);
    }

    return { found: true, count: result.Items.length };
    
  } catch (error) {
    console.log(`❌ Error accessing table: ${error.message}`);
    
    if (error.name === 'ResourceNotFoundException') {
      console.log(`   💡 Table doesn't exist yet - it will be created on first deployment`);
    } else if (error.name === 'AccessDeniedException') {
      console.log(`   💡 Check AWS credentials and IAM permissions`);
    }
    
    return { found: false, count: 0, error: error.message };
  }
}

async function verifyAll() {
  console.log('🔍 Verifying DynamoDB Data Synchronization');
  console.log('=' .repeat(60));
  console.log(`Shop: ${shopDomain}`);
  console.log(`Region: ${region}`);
  console.log('=' .repeat(60));

  const results = {
    products: await verifyTable(tables.products, 'Products'),
    orders: await verifyTable(tables.orders, 'Orders'),
    customers: await verifyTable(tables.customers, 'Customers'),
    webhookEvents: await verifyTable(tables.webhookEvents, 'Webhook Events')
  };

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));

  const totalItems = Object.values(results).reduce((sum, r) => sum + r.count, 0);
  const tablesWithData = Object.values(results).filter(r => r.found).length;

  console.log(`\n✅ Tables with data: ${tablesWithData}/4`);
  console.log(`📦 Total items: ${totalItems}`);

  if (tablesWithData === 0) {
    console.log('\n⚠️  No data found in any tables');
    console.log('\n💡 Next steps:');
    console.log('   1. Ensure OAuth authentication is complete:');
    console.log('      node test/check-token.js');
    console.log('');
    console.log('   2. Create a real product in Shopify Admin');
    console.log('   3. Configure webhook to trigger on product creation');
    console.log('   4. Check CloudWatch logs:');
    console.log('      node test/view-logs.js');
    console.log('');
    console.log('   See WEBHOOK-SETUP.md for detailed instructions');
  } else if (results.products.found) {
    console.log('\n🎉 Products are syncing successfully!');
    console.log('\n💡 You can:');
    console.log('   - Create/update more products to test further');
    console.log('   - Set up order and customer webhooks');
    console.log('   - Monitor CloudWatch logs for webhook processing');
  } else if (results.webhookEvents.found) {
    console.log('\n✅ Webhooks are being received and logged!');
    console.log('\n⚠️  However, product/order/customer data is not syncing');
    console.log('\n💡 Possible reasons:');
    console.log('   - Test webhooks using fake IDs (expected behavior)');
    console.log('   - OAuth scopes insufficient');
    console.log('   - GraphQL queries failing');
    console.log('');
    console.log('   Check logs for details: node test/view-logs.js');
  }

  console.log('\n' + '='.repeat(60));
}

// Run verification
verifyAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


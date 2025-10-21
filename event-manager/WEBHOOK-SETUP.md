# Webhook Setup Guide

This guide will walk you through setting up real Shopify webhooks to test end-to-end data synchronization.

## Prerequisites

✅ OAuth authentication completed with required scopes:
- `read_products` or `write_products`
- `read_orders`
- `read_customers`

✅ Service deployed to AWS:
- Endpoint: `https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev`

✅ Verify token scopes:
```bash
node test/check-token.js
```

## Quick Setup: Product Webhooks

### Step 1: Verify Infrastructure

Run the automated test suite to ensure all endpoints are accessible:

```bash
node test/test-webhooks.js
```

**Expected Result:** All tests return 200 OK (even with "data sync failed" - this is normal with fake IDs)

### Step 2: Register Product Webhooks

You have two options:

#### Option A: Via Shopify Admin (Recommended for Testing)

1. **Go to your Shopify Admin:**
   ```
   https://don-stefani-demo-store.myshopify.com/admin/settings/notifications
   ```

2. **Scroll to "Webhooks" section** at the bottom

3. **Click "Create webhook"**

4. **Configure Product Creation Webhook:**
   - **Event:** `Product creation`
   - **Format:** `JSON`
   - **URL:** `https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/create`
   - **Webhook API version:** `2025-07` (or latest)

5. **Click "Save"**

6. **Repeat for other events** (optional):
   - `Product update` → `/webhooks/products/update`
   - `Product deletion` → `/webhooks/products/delete`

#### Option B: Programmatically via API

Use the webhook management API:

```bash
# Product create
curl -X POST "https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/api/webhooks/register" \
  -H "Content-Type: application/json" \
  -d '{
    "shop": "don-stefani-demo-store.myshopify.com",
    "topic": "products/create",
    "address": "https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/create"
  }'

# Product update
curl -X POST "https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/api/webhooks/register" \
  -H "Content-Type: application/json" \
  -d '{
    "shop": "don-stefani-demo-store.myshopify.com",
    "topic": "products/update",
    "address": "https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/update"
  }'
```

### Step 3: Create a Test Product

1. **Go to Products** in Shopify Admin
2. **Click "Add product"**
3. **Fill in basic details:**
   - Title: `Webhook Test Product`
   - Price: `$29.99`
   - Add any other details you want
4. **Click "Save"**

🎉 **This triggers the `products/create` webhook!**

### Step 4: View Logs

Check CloudWatch logs to see the webhook processing:

```bash
node test/view-logs.js
```

**Look for:**
- ✅ "Product created in shop..." log entry
- ✅ "Product data synchronized to DynamoDB" message
- ✅ No "Access denied" errors
- ✅ Product details logged

### Step 5: Verify DynamoDB

Check that data was stored:

```bash
# Query DynamoDB for the product
aws dynamodb scan \
  --table-name operations-event-manager-products-dev \
  --region us-east-1 \
  --max-items 5
```

Or use the verification script (see below).

### Step 6: Test Product Update

1. **Edit the test product** you just created
2. **Change the title** to `Webhook Test Product - Updated`
3. **Click "Save"**

🎉 **This triggers the `products/update` webhook!**

Check logs again to see the update processing.

## Complete Webhook Configuration

### All Supported Webhooks:

#### Products:
```bash
# Products create
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/create

# Products update
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/update

# Products delete
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/products/delete
```

#### Orders:
```bash
# Order creation
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/orders/create

# Order updated
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/orders/updated

# Order paid
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/orders/paid

# Order cancelled
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/orders/cancelled

# Order fulfilled
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/orders/fulfilled
```

#### Customers:
```bash
# Customer create
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/customers/create

# Customer update
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/customers/update
```

#### App:
```bash
# App uninstalled
POST https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/webhooks/app/uninstalled
```

## Bulk Registration Script

Register all common webhooks at once:

```bash
#!/bin/bash

SHOP="don-stefani-demo-store.myshopify.com"
BASE_URL="https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev"

# Product webhooks
for topic in "products/create" "products/update" "products/delete"; do
  echo "Registering $topic..."
  curl -X POST "$BASE_URL/api/webhooks/register" \
    -H "Content-Type: application/json" \
    -d "{\"shop\": \"$SHOP\", \"topic\": \"$topic\", \"address\": \"$BASE_URL/webhooks/${topic}\"}"
  echo ""
done

# Order webhooks
for topic in "orders/create" "orders/updated" "orders/paid"; do
  echo "Registering $topic..."
  curl -X POST "$BASE_URL/api/webhooks/register" \
    -H "Content-Type: application/json" \
    -d "{\"shop\": \"$SHOP\", \"topic\": \"$topic\", \"address\": \"$BASE_URL/webhooks/${topic}\"}"
  echo ""
done

# Customer webhooks
for topic in "customers/create" "customers/update"; do
  echo "Registering $topic..."
  curl -X POST "$BASE_URL/api/webhooks/register" \
    -H "Content-Type: application/json" \
    -d "{\"shop\": \"$SHOP\", \"topic\": \"$topic\", \"address\": \"$BASE_URL/webhooks/${topic}\"}"
  echo ""
done

echo "Webhook registration complete!"
```

Save as `register-all-webhooks.sh` and run:
```bash
chmod +x register-all-webhooks.sh
./register-all-webhooks.sh
```

## Troubleshooting

### Check Registered Webhooks

List all currently registered webhooks:

```bash
curl "https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev/api/webhooks/list?shop=don-stefani-demo-store.myshopify.com"
```

### View Recent Logs

```bash
node test/view-logs.js
```

### Common Issues

**Issue:** "Access denied" errors
**Solution:** Re-authenticate with correct scopes (run `node test/check-token.js` to verify)

**Issue:** Webhook not firing
**Solution:** 
- Check webhook is registered correctly in Shopify
- Verify URL is correct
- Check HMAC verification isn't blocking (currently disabled for testing)

**Issue:** "Unknown error" with real product IDs
**Solution:**
- Check CloudWatch logs for detailed error message
- Verify product exists in Shopify
- Ensure GraphQL API version is compatible

### Re-authenticate

If you need to update scopes:

```bash
# Delete old token
node test/delete-token.js

# Visit OAuth URL
# https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev/auth/shopify?shop=don-stefani-demo-store.myshopify.com

# Verify new token
node test/check-token.js
```

## Monitoring

### CloudWatch Logs

View logs in AWS Console:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Foperations-event-manager-dev-webhook-processor
```

### DynamoDB Tables

View tables in AWS Console:
- [Products Table](https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#table?name=operations-event-manager-products-dev)
- [Orders Table](https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#table?name=operations-event-manager-orders-dev)
- [Customers Table](https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#table?name=operations-event-manager-customers-dev)
- [Webhook Events Table](https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#table?name=operations-event-manager-webhook-events-dev)

## Success Criteria

✅ **Infrastructure Working:**
- Synthetic tests return 200 OK
- Token has correct scopes
- No authentication errors

✅ **Webhooks Working:**
- Real product creates/updates trigger webhooks
- CloudWatch shows "Product data synchronized to DynamoDB"
- No GraphQL errors in logs

✅ **Data Synced:**
- Products appear in DynamoDB with full data
- All fields populated correctly
- Variants, images, and metadata included

## Next Steps

Once webhooks are working with products:

1. **Test order webhooks** - Place a test order in your store
2. **Test customer webhooks** - Create/update a customer
3. **Enable HMAC verification** - Uncomment verification middleware
4. **Production deployment** - Update environment variables
5. **Monitor and optimize** - Set up alerts and monitoring

## Resources

- [Shopify Webhooks Documentation](https://shopify.dev/docs/api/admin-rest/latest/resources/webhook)
- [GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
- [AWS Lambda Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html)


#!/bin/bash

# Bulk Webhook Registration Script
# Registers all supported webhooks for your Shopify store

SHOP="don-stefani-demo-store.myshopify.com"
BASE_URL="https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev"

echo "🚀 Registering Shopify Webhooks"
echo "================================"
echo "Shop: $SHOP"
echo "Base URL: $BASE_URL"
echo "================================"
echo ""

# Counter for success/failure
SUCCESS=0
FAILED=0

# Function to register a webhook
register_webhook() {
  local topic=$1
  local url="${BASE_URL}/webhooks/${topic}"
  
  echo "📝 Registering: $topic"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/webhooks/register?shop=${SHOP}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\": \"${topic}\", \"address\": \"${url}\"}")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "   ✅ Success"
    ((SUCCESS++))
  else
    echo "   ❌ Failed (HTTP $http_code)"
    echo "   Response: $body"
    ((FAILED++))
  fi
  
  echo ""
}

echo "📦 Registering Product Webhooks..."
echo ""
register_webhook "products/create"
register_webhook "products/update"
register_webhook "products/delete"

echo "🛒 Registering Order Webhooks..."
echo ""
register_webhook "orders/create"
register_webhook "orders/updated"
register_webhook "orders/paid"
register_webhook "orders/cancelled"
register_webhook "orders/fulfilled"

echo "👤 Registering Customer Webhooks..."
echo ""
register_webhook "customers/create"
register_webhook "customers/update"

echo "🔔 Registering App Webhooks..."
echo ""
register_webhook "app/uninstalled"

echo "================================"
echo "📊 Registration Summary"
echo "================================"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All webhooks registered successfully!"
  echo ""
  echo "💡 Next steps:"
  echo "   1. Create/update a product in Shopify Admin"
  echo "   2. Check CloudWatch logs: node test/view-logs.js"
  echo "   3. Verify DynamoDB: node test/verify-dynamodb.js"
else
  echo "⚠️  Some webhooks failed to register"
  echo ""
  echo "💡 Troubleshooting:"
  echo "   - Check OAuth token: node test/check-token.js"
  echo "   - Verify scopes include write permissions"
  echo "   - Check CloudWatch logs for errors"
fi

echo ""
echo "To list registered webhooks:"
echo "curl \"${BASE_URL}/api/webhooks/list?shop=${SHOP}\""
echo ""


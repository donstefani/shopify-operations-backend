#!/bin/bash

# Event Manager Deployment Test Script
# Tests the deployed AWS Lambda endpoints

BASE_URL="https://q1o3ju0dpk.execute-api.us-east-1.amazonaws.com/dev"
SHOPIFY_WEBHOOK_SECRET="0b5507c781a9f16ba155fda0a91dd91dc3cafb8789db2b848a9ff6081b9c327c"

echo "🧪 Event Manager Deployment Test Suite"
echo "========================================="
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check / Root Endpoint
echo "Test 1: Health Check"
echo "---------------------"
curl -s -X GET "$BASE_URL/" | jq '.' || echo "Failed to parse JSON"
echo -e "\n"

# Test 2: Webhook Management - List Webhooks
echo "Test 2: List Registered Webhooks"
echo "---------------------------------"
curl -s -X GET "$BASE_URL/api/webhooks" \
  -H "Content-Type: application/json" \
  | jq '.' || echo "Failed to parse JSON"
echo -e "\n"

# Test 3: Test Product Webhook
echo "Test 3: Product Creation Webhook (Simulated)"
echo "---------------------------------------------"
PRODUCT_DATA='{
  "id": 12345678901234,
  "title": "Test Product from Deployment Test",
  "handle": "test-product-deployment",
  "vendor": "Test Vendor",
  "product_type": "Test Type",
  "created_at": "2025-10-16T18:00:00Z",
  "updated_at": "2025-10-16T18:00:00Z"
}'

# Calculate HMAC for Shopify webhook verification
HMAC=$(echo -n "$PRODUCT_DATA" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)

curl -s -X POST "$BASE_URL/webhooks/products/create" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: products/create" \
  -H "X-Shopify-Shop-Domain: don-stefani-demo-store.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Webhook-Id: test-webhook-$(date +%s)" \
  -d "$PRODUCT_DATA" \
  | jq '.' || echo "Failed to parse JSON"
echo -e "\n"

# Test 4: Test Order Webhook
echo "Test 4: Order Creation Webhook (Simulated)"
echo "-------------------------------------------"
ORDER_DATA='{
  "id": 98765432109876,
  "order_number": 1001,
  "email": "customer@example.com",
  "created_at": "2025-10-16T18:00:00Z",
  "total_price": "199.99",
  "currency": "USD",
  "financial_status": "paid",
  "fulfillment_status": null
}'

HMAC=$(echo -n "$ORDER_DATA" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)

curl -s -X POST "$BASE_URL/webhooks/orders/create" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: don-stefani-demo-store.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Webhook-Id: test-webhook-$(date +%s)" \
  -d "$ORDER_DATA" \
  | jq '.' || echo "Failed to parse JSON"
echo -e "\n"

# Test 5: Webhook Registration (requires auth token)
echo "Test 5: Webhook Registration Endpoint"
echo "--------------------------------------"
echo "Note: This requires authentication from auth-service"
curl -s -X POST "$BASE_URL/api/webhooks/register" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "products/create",
    "address": "'"$BASE_URL"'/webhooks/products/create",
    "shop": "don-stefani-demo-store.myshopify.com"
  }' \
  | jq '.' || echo "Failed (expected - needs auth token)"
echo -e "\n"

echo "========================================="
echo "✅ Deployment tests complete!"
echo ""
echo "API Endpoints:"
echo "  - Health: $BASE_URL/"
echo "  - Webhooks: $BASE_URL/webhooks/{topic}/{action}"
echo "  - Management: $BASE_URL/api/webhooks"


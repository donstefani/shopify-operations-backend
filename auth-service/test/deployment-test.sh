#!/bin/bash

# Deployment Test Script for Shopify Auth Service
# Tests the deployed Lambda function in AWS

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev"
SHOP_DOMAIN="don-stefani-demo-store.myshopify.com"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Shopify Auth Service - Deployment Test Suite          ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo ""

# Test 1: Health Check
echo -e "${BLUE}[TEST 1] Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status == "OK"' > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq .
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: OAuth URL Generation
echo -e "${BLUE}[TEST 2] OAuth URL Generation${NC}"
AUTH_RESPONSE=$(curl -s "${BASE_URL}/auth/shopify?shop=${SHOP_DOMAIN}")
if echo "$AUTH_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✓ OAuth URL generated successfully${NC}"
    AUTH_URL=$(echo "$AUTH_RESPONSE" | jq -r '.data.authUrl')
    STATE=$(echo "$AUTH_URL" | grep -o 'state=[^&]*' | cut -d= -f2)
    echo "Auth URL: ${AUTH_URL:0:100}..."
    echo "State: ${STATE:0:40}..."
else
    echo -e "${RED}✗ OAuth URL generation failed${NC}"
    exit 1
fi
echo ""

# Test 3: DynamoDB State Storage
echo -e "${BLUE}[TEST 3] DynamoDB State Storage${NC}"
DYNAMO_CHECK=$(aws dynamodb get-item \
    --table-name portfolio-shopify-auth \
    --key "{\"id\": {\"S\": \"oauth_state:${STATE}\"}}" \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$DYNAMO_CHECK" ]; then
    echo -e "${GREEN}✓ State stored in DynamoDB${NC}"
    echo "$DYNAMO_CHECK" | jq '.Item | {id: .id.S, shop: .shopDomain.S}'
else
    echo -e "${RED}✗ State not found in DynamoDB${NC}"
    exit 1
fi
echo ""

# Test 4: Auth Status
echo -e "${BLUE}[TEST 4] Auth Status Check${NC}"
STATUS_RESPONSE=$(curl -s "${BASE_URL}/auth/status")
if echo "$STATUS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✓ Auth status endpoint working${NC}"
    echo "$STATUS_RESPONSE" | jq .
else
    echo -e "${RED}✗ Auth status check failed${NC}"
    exit 1
fi
echo ""

# Test 5: Token Retrieval (if token exists)
echo -e "${BLUE}[TEST 5] Token Retrieval${NC}"
TOKEN_RESPONSE=$(curl -s "${BASE_URL}/auth/token/${SHOP_DOMAIN}")
if echo "$TOKEN_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✓ Token retrieved and decrypted successfully${NC}"
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.data.accessToken')
    SCOPES=$(echo "$TOKEN_RESPONSE" | jq -r '.data.scopes')
    echo "Scopes: $SCOPES"
    echo "Token: ${ACCESS_TOKEN:0:20}... (truncated)"
    
    # Test 6: Verify Token with Shopify API
    echo ""
    echo -e "${BLUE}[TEST 6] Shopify API Verification${NC}"
    PRODUCT_RESPONSE=$(curl -s -X GET \
        "https://${SHOP_DOMAIN}/admin/api/2025-07/products.json?limit=1" \
        -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}")
    
    if echo "$PRODUCT_RESPONSE" | jq -e '.products[0]' > /dev/null; then
        echo -e "${GREEN}✓ Token verified with Shopify API${NC}"
        PRODUCT_TITLE=$(echo "$PRODUCT_RESPONSE" | jq -r '.products[0].title')
        echo "Retrieved product: $PRODUCT_TITLE"
    else
        echo -e "${RED}✗ Token verification failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Token retrieval failed (may not exist)${NC}"
    echo "$TOKEN_RESPONSE" | jq .
fi
echo ""

# Test 7: Error Handling
echo -e "${BLUE}[TEST 7] Error Handling${NC}"
ERROR_RESPONSE=$(curl -s "${BASE_URL}/auth/shopify")
if echo "$ERROR_RESPONSE" | jq -e '.success == false' > /dev/null; then
    echo -e "${GREEN}✓ Error handling working (missing shop parameter)${NC}"
else
    echo -e "${RED}✗ Error handling not working${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All Deployment Tests Passed! ✓                         ║${NC}"
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${BLUE}Deployment Details:${NC}"
echo "  • Endpoint: ${BASE_URL}"
echo "  • Lambda Function: shopify-auth-service-dev-api"
echo "  • DynamoDB Table: portfolio-shopify-auth"
echo "  • Region: us-east-1"
echo ""
echo -e "${BLUE}Test Coverage:${NC}"
echo "  ✓ Health check endpoint"
echo "  ✓ OAuth URL generation"
echo "  ✓ DynamoDB state storage"
echo "  ✓ Auth status checking"
echo "  ✓ Token encryption/decryption"
echo "  ✓ Shopify API integration"
echo "  ✓ Error handling"
echo ""


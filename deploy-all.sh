#!/bin/bash

# Deploy all GraphQL microservices
# Run from operations-backend directory

set -e  # Exit on error

echo "======================================"
echo "Deploying Shopify GraphQL Services"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to deploy a service
deploy_service() {
    local service_name=$1
    local service_dir=$2
    
    echo -e "${BLUE}Deploying $service_name...${NC}"
    cd "$service_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Build
    echo "Building..."
    npm run build
    
    # Deploy
    echo "Deploying to AWS..."
    npm run deploy:dev
    
    echo -e "${GREEN}✓ $service_name deployed successfully${NC}"
    echo ""
    
    cd ..
}

# Check if we're in the right directory
if [ ! -d "product-manager" ] || [ ! -d "order-manager" ] || [ ! -d "customer-manager" ]; then
    echo -e "${RED}Error: Please run this script from the operations-backend directory${NC}"
    exit 1
fi

# Deploy all services
deploy_service "Product Manager" "product-manager"
deploy_service "Order Manager" "order-manager"
deploy_service "Customer Manager" "customer-manager"

echo "======================================"
echo -e "${GREEN}All services deployed successfully!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Copy the GraphQL endpoint URLs from the output above"
echo "2. Update operations-ui/.env.local with the URLs"
echo "3. Test the endpoints using GraphQL Playground"
echo ""
echo "Example .env.local format:"
echo "VITE_PRODUCT_API_URL=https://[api-id].execute-api.us-east-1.amazonaws.com/graphql"
echo "VITE_ORDER_API_URL=https://[api-id].execute-api.us-east-1.amazonaws.com/graphql"
echo "VITE_CUSTOMER_API_URL=https://[api-id].execute-api.us-east-1.amazonaws.com/graphql"


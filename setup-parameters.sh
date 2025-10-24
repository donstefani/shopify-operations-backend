#!/bin/bash

# Setup AWS SSM Parameters for GraphQL Services
# This script helps copy parameters from existing services to new ones

set -e

echo "======================================"
echo "AWS SSM Parameter Setup Helper"
echo "======================================"
echo ""

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}This script will help you copy SSM parameters from existing services${NC}"
echo -e "${YELLOW}to the new GraphQL services (product-manager, order-manager, customer-manager)${NC}"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not found. Please install it first."
    exit 1
fi

echo -e "${BLUE}Fetching existing parameters from shopify-auth service...${NC}"
echo ""

# Get existing parameters (show values)
echo "Getting SHOPIFY_CLIENT_ID..."
CLIENT_ID=$(aws ssm get-parameter --name "/shopify-auth/SHOPIFY_CLIENT_ID" --with-decryption --region us-east-1 --query 'Parameter.Value' --output text 2>/dev/null || echo "")

echo "Getting SHOPIFY_CLIENT_SECRET..."
CLIENT_SECRET=$(aws ssm get-parameter --name "/shopify-auth/SHOPIFY_CLIENT_SECRET" --with-decryption --region us-east-1 --query 'Parameter.Value' --output text 2>/dev/null || echo "")

echo "Getting ENCRYPTION_KEY..."
ENCRYPTION_KEY=$(aws ssm get-parameter --name "/shopify-auth/ENCRYPTION_KEY" --with-decryption --region us-east-1 --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$ENCRYPTION_KEY" ]; then
    echo ""
    echo -e "${YELLOW}Warning: Could not fetch all parameters from /shopify-auth/*${NC}"
    echo "You may need to enter them manually or check your AWS credentials."
    echo ""
    read -p "Do you want to enter parameters manually? (y/n): " manual
    
    if [ "$manual" = "y" ]; then
        read -p "Enter SHOPIFY_CLIENT_ID: " CLIENT_ID
        read -p "Enter SHOPIFY_CLIENT_SECRET: " CLIENT_SECRET
        read -p "Enter ENCRYPTION_KEY (32 chars): " ENCRYPTION_KEY
    else
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Parameters retrieved successfully!${NC}"
echo ""
echo "Creating parameters for product-manager..."

aws ssm put-parameter \
    --name "/shopify-products/SHOPIFY_CLIENT_ID" \
    --value "$CLIENT_ID" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_ID created" || echo "✓ CLIENT_ID already exists"

aws ssm put-parameter \
    --name "/shopify-products/SHOPIFY_CLIENT_SECRET" \
    --value "$CLIENT_SECRET" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_SECRET created" || echo "✓ CLIENT_SECRET already exists"

aws ssm put-parameter \
    --name "/shopify-products/ENCRYPTION_KEY" \
    --value "$ENCRYPTION_KEY" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ ENCRYPTION_KEY created" || echo "✓ ENCRYPTION_KEY already exists"

echo ""
echo "Creating parameters for order-manager..."

aws ssm put-parameter \
    --name "/shopify-orders/SHOPIFY_CLIENT_ID" \
    --value "$CLIENT_ID" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_ID created" || echo "✓ CLIENT_ID already exists"

aws ssm put-parameter \
    --name "/shopify-orders/SHOPIFY_CLIENT_SECRET" \
    --value "$CLIENT_SECRET" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_SECRET created" || echo "✓ CLIENT_SECRET already exists"

aws ssm put-parameter \
    --name "/shopify-orders/ENCRYPTION_KEY" \
    --value "$ENCRYPTION_KEY" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ ENCRYPTION_KEY created" || echo "✓ ENCRYPTION_KEY already exists"

echo ""
echo "Creating parameters for customer-manager..."

aws ssm put-parameter \
    --name "/shopify-customers/SHOPIFY_CLIENT_ID" \
    --value "$CLIENT_ID" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_ID created" || echo "✓ CLIENT_SECRET already exists"

aws ssm put-parameter \
    --name "/shopify-customers/SHOPIFY_CLIENT_SECRET" \
    --value "$CLIENT_SECRET" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ CLIENT_SECRET created" || echo "✓ CLIENT_SECRET already exists"

aws ssm put-parameter \
    --name "/shopify-customers/ENCRYPTION_KEY" \
    --value "$ENCRYPTION_KEY" \
    --type "SecureString" \
    --region us-east-1 \
    --overwrite 2>/dev/null && echo "✓ ENCRYPTION_KEY created" || echo "✓ ENCRYPTION_KEY already exists"

echo ""
echo -e "${GREEN}======================================"
echo "All parameters created successfully!"
echo "======================================${NC}"
echo ""
echo "You can now deploy the services:"
echo "  cd operations-backend"
echo "  ./deploy-all.sh"
echo ""


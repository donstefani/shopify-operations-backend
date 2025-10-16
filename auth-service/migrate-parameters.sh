#!/bin/bash

# Script to migrate AWS Parameter Store values from us-east-2 to us-east-1
# Run this script to create the parameters in the new region

echo "Migrating AWS Parameter Store values to us-east-1..."

# Set the region
REGION="us-east-1"

# Create parameters in the new region (with overwrite enabled)
echo "Creating/Updating SHOPIFY_CLIENT_ID parameter..."
aws ssm put-parameter \
  --region $REGION \
  --name "/shopify-auth/SHOPIFY_CLIENT_ID" \
  --value "a45e26c78383911f99e90b21f71b6cf3" \
  --type "SecureString" \
  --overwrite \
  --description "Shopify Client ID for authentication service"

echo "Creating/Updating SHOPIFY_CLIENT_SECRET parameter..."
aws ssm put-parameter \
  --region $REGION \
  --name "/shopify-auth/SHOPIFY_CLIENT_SECRET" \
  --value "e83b663a2eefcd298a08a44785edeeb6" \
  --type "SecureString" \
  --overwrite \
  --description "Shopify Client Secret for authentication service"

echo "Creating/Updating SHOPIFY_REDIRECT_URI parameter..."
aws ssm put-parameter \
  --region $REGION \
  --name "/shopify-auth/SHOPIFY_REDIRECT_URI" \
  --value "https://s0avdp4219.execute-api.us-east-1.amazonaws.com/dev/auth/shopify/callback" \
  --type "SecureString" \
  --overwrite \
  --description "Shopify Redirect URI for authentication service"

echo "Creating/Updating SESSION_SECRET parameter..."
aws ssm put-parameter \
  --region $REGION \
  --name "/shopify-auth/SESSION_SECRET" \
  --value "3c0ac4383d87b009a08ee6e76619f8ed069b6f68b42c940e8fb7bd60fb0b1c1d" \
  --type "SecureString" \
  --overwrite \
  --description "Session secret for authentication service"

echo "Creating/Updating ENCRYPTION_KEY parameter..."
aws ssm put-parameter \
  --region $REGION \
  --name "/shopify-auth/ENCRYPTION_KEY" \
  --value "9289c62c6bbf3182a4fe37dfc49420d84c8847f8065d6784f4211bca5a5ba7f4" \
  --type "SecureString" \
  --overwrite \
  --description "Encryption key for authentication service"

echo "Migration completed! All parameters have been created in us-east-1"
echo ""
echo "You can verify the parameters were created by running:"
echo "aws ssm get-parameters-by-path --region us-east-1 --path '/shopify-auth' --recursive"

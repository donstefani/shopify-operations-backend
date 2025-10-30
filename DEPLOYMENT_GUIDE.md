# GraphQL Services Deployment Guide

This guide walks through deploying the three new GraphQL microservices: product-manager, order-manager, and customer-manager.

## Prerequisites

Before deploying, ensure you have:

- [x] AWS CLI configured with credentials
- [x] Serverless Framework v4 installed globally (`npm install -g serverless`)
- [x] Node.js 22+ installed
- [x] Existing DynamoDB tables (already created by event-manager)
- [x] Auth service deployed (for token access)

## Required AWS SSM Parameters

Each service needs these parameters in AWS Systems Manager Parameter Store:

### For product-manager

```bash
# Use the same credentials from your existing services
aws ssm put-parameter --name "/shopify-products/SHOPIFY_CLIENT_ID" \
  --value "YOUR_SHOPIFY_CLIENT_ID" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-products/SHOPIFY_CLIENT_SECRET" \
  --value "YOUR_SHOPIFY_CLIENT_SECRET" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-products/ENCRYPTION_KEY" \
  --value "YOUR_32_CHAR_ENCRYPTION_KEY" --type "SecureString" --region us-east-1
```

### For order-manager

```bash
aws ssm put-parameter --name "/shopify-orders/SHOPIFY_CLIENT_ID" \
  --value "YOUR_SHOPIFY_CLIENT_ID" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-orders/SHOPIFY_CLIENT_SECRET" \
  --value "YOUR_SHOPIFY_CLIENT_SECRET" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-orders/ENCRYPTION_KEY" \
  --value "YOUR_32_CHAR_ENCRYPTION_KEY" --type "SecureString" --region us-east-1
```

### For customer-manager

```bash
aws ssm put-parameter --name "/shopify-customers/SHOPIFY_CLIENT_ID" \
  --value "YOUR_SHOPIFY_CLIENT_ID" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-customers/SHOPIFY_CLIENT_SECRET" \
  --value "YOUR_SHOPIFY_CLIENT_SECRET" --type "SecureString" --region us-east-1

aws ssm put-parameter --name "/shopify-customers/ENCRYPTION_KEY" \
  --value "YOUR_32_CHAR_ENCRYPTION_KEY" --type "SecureString" --region us-east-1
```

**Note**: Use the same values from your existing auth-service and event-manager parameters.

### Quick Copy from Existing Parameters

```bash
# Get existing values (you'll need to run these and copy the values)
aws ssm get-parameter --name "/shopify-auth/SHOPIFY_CLIENT_ID" --with-decryption --region us-east-1
aws ssm get-parameter --name "/shopify-auth/SHOPIFY_CLIENT_SECRET" --with-decryption --region us-east-1
aws ssm get-parameter --name "/shopify-auth/ENCRYPTION_KEY" --with-decryption --region us-east-1
```

## Deployment Steps

### 1. Deploy Product Manager

```bash
cd operations-backend/product-manager

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to AWS
npm run deploy:dev
```

**Expected Output:**
```
✔ Service deployed to stack product-manager-dev
endpoint: ANY - https://[your-api-id].execute-api.us-east-1.amazonaws.com/graphql
functions:
  graphql: product-manager-dev-graphql
```

**Copy the endpoint URL** - you'll need this for the frontend.

### 2. Deploy Order Manager

```bash
cd ../order-manager

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to AWS
npm run deploy:dev
```

**Copy the endpoint URL** from the output.

### 3. Deploy Customer Manager

```bash
cd ../customer-manager

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to AWS
npm run deploy:dev
```

**Copy the endpoint URL** from the output.

## Verify Deployments

### Test GraphQL Endpoints

You can test each endpoint using curl or the GraphQL Playground:

#### Product Manager
```bash
curl -X POST https://[product-api-id].execute-api.us-east-1.amazonaws.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { productStats(shopDomain: \"don-stefani-demo-store.myshopify.com\") { total byStatus { active draft archived } } }"}'
```

#### Order Manager
```bash
curl -X POST https://[order-api-id].execute-api.us-east-1.amazonaws.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { orderStats(shopDomain: \"don-stefani-demo-store.myshopify.com\") { total totalRevenue } }"}'
```

#### Customer Manager
```bash
curl -X POST https://[customer-api-id].execute-api.us-east-1.amazonaws.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { customerStats(shopDomain: \"don-stefani-demo-store.myshopify.com\") { total totalLifetimeValue } }"}'
```

### Access GraphQL Playground

Each service has GraphQL introspection enabled. Visit:
- `https://[api-id].execute-api.us-east-1.amazonaws.com/graphql`

In your browser to access the GraphQL Playground (Apollo Studio Sandbox will load).

## Update Frontend Configuration

After deployment, update `operations-ui/.env.local`:

```env
VITE_PRODUCT_API_URL=https://[product-api-id].execute-api.us-east-1.amazonaws.com/graphql
VITE_ORDER_API_URL=https://[order-api-id].execute-api.us-east-1.amazonaws.com/graphql
VITE_CUSTOMER_API_URL=https://[customer-api-id].execute-api.us-east-1.amazonaws.com/graphql
VITE_EVENT_API_URL=https://[event-api-id].execute-api.us-east-1.amazonaws.com/graphql
VITE_SHOP_DOMAIN=don-stefani-demo-store.myshopify.com
```

## Troubleshooting

### "Parameter not found" Error

If you see this error during deployment:
```
Parameter /shopify-products/SHOPIFY_CLIENT_ID not found
```

Make sure you've created all the SSM parameters as shown above.

### "Table does not exist" Error

The DynamoDB tables should already exist from the event-manager. Verify:
```bash
aws dynamodb describe-table --table-name operations-event-manager-products-dev --region us-east-1
aws dynamodb describe-table --table-name operations-event-manager-orders-dev --region us-east-1
aws dynamodb describe-table --table-name operations-event-manager-customers-dev --region us-east-1
```

### GraphQL Errors

Check CloudWatch logs:
```bash
# Product Manager logs
aws logs tail /aws/lambda/product-manager-dev-graphql --follow

# Order Manager logs
aws logs tail /aws/lambda/order-manager-dev-graphql --follow

# Customer Manager logs
aws logs tail /aws/lambda/customer-manager-dev-graphql --follow
```

### CORS Issues

If you get CORS errors from the frontend, the serverless.yml files are already configured with CORS. You may need to add your frontend URL after deployment:

Update each `serverless.yml`:
```yaml
cors:
  allowedOrigins:
    - http://localhost:5173
    - https://your-deployed-frontend.vercel.app  # Add after frontend deployment
```

Then redeploy:
```bash
npm run deploy:dev
```

## View Deployed Resources

### List all deployed functions
```bash
serverless info --verbose
```

### View API Gateway endpoints
```bash
aws apigatewayv2 get-apis --region us-east-1 | grep -A 5 "product-manager\|order-manager\|customer-manager"
```

### View CloudWatch logs
```bash
serverless logs -f graphql -t
```

## Rollback (if needed)

If something goes wrong:
```bash
serverless remove
```

This will remove all Lambda functions, API Gateway, and CloudFormation stack (but NOT DynamoDB tables).

## Next Steps

After successful deployment:

1. ✅ Copy all three GraphQL endpoint URLs
2. ✅ Update `operations-ui/.env.local` with the URLs
3. ✅ Test each endpoint with sample queries
4. ✅ Continue with frontend development
5. ✅ Deploy frontend to Vercel/Netlify
6. ✅ Update backend CORS with production frontend URL

## Cost Estimate

With AWS Free Tier:
- Lambda: First 1M requests/month free
- API Gateway: First 1M requests/month free
- DynamoDB: Already created, on-demand billing
- CloudWatch: Basic logs included

**Estimated monthly cost**: $0-5 for low traffic demo/portfolio


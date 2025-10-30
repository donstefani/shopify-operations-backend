# Product Manager Service

GraphQL microservice for managing Shopify products with DynamoDB as the source of truth.

## Features

- **GraphQL API** with Apollo Server
- **DynamoDB** for data storage
- **Shopify Sync** using Shopify GraphQL API
- **Full CRUD** operations (Create, Read, Update, Delete)
- **Pagination** support with cursor-based navigation
- **Filtering** by status and search
- **Statistics** endpoint for dashboard
- **Serverless** deployment with AWS Lambda

## Setup

### Prerequisites

- Node.js 22+
- AWS CLI configured
- Serverless Framework v4

### Installation

```bash
npm install
```

### Environment Variables

Required AWS SSM Parameters:
- `/shopify-products/SHOPIFY_CLIENT_ID`
- `/shopify-products/SHOPIFY_CLIENT_SECRET`
- `/shopify-products/ENCRYPTION_KEY`

### Development

```bash
npm run build
npm run offline
```

Access GraphQL Playground at: `http://localhost:3000/graphql`

### Deployment

```bash
npm run deploy:dev
```

## GraphQL Schema

### Queries

```graphql
query GetProducts {
  products(shopDomain: "your-store.myshopify.com", limit: 20) {
    items {
      id
      shopifyId
      title
      price
      status
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

query GetProductStats {
  productStats(shopDomain: "your-store.myshopify.com") {
    total
    byStatus {
      active
      draft
      archived
    }
  }
}
```

### Mutations

```graphql
mutation CreateProduct {
  createProduct(
    shopDomain: "your-store.myshopify.com"
    input: {
      title: "New Product"
      handle: "new-product"
      price: 29.99
      inventoryQuantity: 100
      status: ACTIVE
    }
  ) {
    id
    shopifyId
    title
    syncStatus
  }
}
```

## Architecture

```
UI → GraphQL API → DynamoDB (source of truth) → Shopify API
```

**Data Flow:**
1. Client sends mutation to GraphQL API
2. Service writes to DynamoDB with `syncStatus: PENDING`
3. Service syncs to Shopify GraphQL API
4. Service updates DynamoDB with `syncStatus: SYNCED`
5. If Shopify fails, `syncStatus: FAILED`

## DynamoDB Table Structure

**Table**: `operations-event-manager-products-dev`

- **Partition Key**: `shop_domain` (String)
- **Sort Key**: `product_id` (String) - Format: `PRODUCT#<shopify_id>`

**Attributes**:
- shopify_id, title, handle, vendor, product_type
- tags (List), price (Number), inventory_quantity (Number)
- status (String), sync_status (String)
- created_at (String), updated_at (String)


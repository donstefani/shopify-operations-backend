# Order Manager Service

GraphQL microservice for managing Shopify orders with DynamoDB as the source of truth.

## Features

- **GraphQL API** with Apollo Server
- **DynamoDB** for data storage (read-mostly, webhooks populate)
- **Full Read Operations** with filtering and pagination
- **Limited Write Operations** (status updates, cancellation)
- **Statistics** endpoint for dashboard analytics

## Setup

### Installation

```bash
npm install
```

### Development

```bash
npm run build
npm run offline
```

### Deployment

```bash
npm run deploy:dev
```

## GraphQL Schema

### Queries

```graphql
query GetOrders {
  orders(shopDomain: "your-store.myshopify.com", limit: 20) {
    items {
      id
      shopifyId
      orderNumber
      customerEmail
      totalPrice
      status
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

query GetOrderStats {
  orderStats(shopDomain: "your-store.myshopify.com") {
    total
    totalRevenue
    byStatus {
      pending
      paid
      fulfilled
      cancelled
    }
  }
}
```

### Mutations

```graphql
mutation UpdateOrder {
  updateOrder(
    shopDomain: "your-store.myshopify.com"
    shopifyId: "123456789"
    input: {
      status: "processing"
      fulfillmentStatus: "fulfilled"
    }
  ) {
    id
    status
    fulfillmentStatus
  }
}

mutation CancelOrder {
  cancelOrder(
    shopDomain: "your-store.myshopify.com"
    shopifyId: "123456789"
  ) {
    id
    status
  }
}
```

## DynamoDB Table Structure

**Table**: `operations-event-manager-orders-dev`

- **Partition Key**: `shop_domain` (String)
- **Sort Key**: `order_id` (String) - Format: `ORDER#<shopify_id>`

**Note**: Orders are primarily populated by webhook events from the event-manager service.


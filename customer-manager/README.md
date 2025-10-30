# Customer Manager Service

GraphQL microservice for managing Shopify customers with DynamoDB as the source of truth.

## Features

- **GraphQL API** with Apollo Server
- **DynamoDB** for data storage
- **Full CRUD** operations
- **Pagination** and **filtering** support
- **Statistics** endpoint for dashboard

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
query GetCustomers {
  customers(shopDomain: "your-store.myshopify.com", limit: 20) {
    items {
      id
      shopifyId
      email
      firstName
      lastName
      totalSpent
      ordersCount
      state
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

query GetCustomerStats {
  customerStats(shopDomain: "your-store.myshopify.com") {
    total
    totalLifetimeValue
    averageOrderValue
    byState {
      enabled
      disabled
      invited
      declined
    }
  }
}
```

### Mutations

```graphql
mutation CreateCustomer {
  createCustomer(
    shopDomain: "your-store.myshopify.com"
    input: {
      email: "customer@example.com"
      firstName: "John"
      lastName: "Doe"
      phone: "+1234567890"
      state: ENABLED
    }
  ) {
    id
    email
    state
  }
}

mutation UpdateCustomer {
  updateCustomer(
    shopDomain: "your-store.myshopify.com"
    shopifyId: "123456789"
    input: {
      firstName: "Jane"
      state: DISABLED
    }
  ) {
    id
    firstName
    state
  }
}
```

## DynamoDB Table Structure

**Table**: `operations-event-manager-customers-dev`

- **Partition Key**: `shop_domain` (String)
- **Sort Key**: `customer_id` (String) - Format: `CUSTOMER#<shopify_id>`


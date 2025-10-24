import gql from 'graphql-tag';

export const typeDefs = gql`
  type Order {
    id: ID!
    shopifyId: String!
    shopDomain: String!
    orderNumber: String!
    customerId: String
    customerEmail: String
    totalPrice: Float!
    currency: String!
    status: String!
    fulfillmentStatus: String
    financialStatus: String
    syncStatus: SyncStatus!
    createdAt: String!
    updatedAt: String!
  }

  enum SyncStatus {
    PENDING
    SYNCED
    FAILED
  }

  type OrderConnection {
    items: [Order!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type OrderStats {
    total: Int!
    totalRevenue: Float!
    byStatus: OrderStatusBreakdown!
  }

  type OrderStatusBreakdown {
    pending: Int!
    paid: Int!
    fulfilled: Int!
    cancelled: Int!
  }

  input CreateOrderInput {
    customerId: String
    customerEmail: String!
    totalPrice: Float!
    currency: String!
    status: String!
  }

  input UpdateOrderInput {
    status: String
    fulfillmentStatus: String
    financialStatus: String
  }

  input OrderFilters {
    status: String
    customerEmail: String
    orderNumber: String
  }

  type Query {
    orders(
      shopDomain: String!
      limit: Int = 20
      cursor: String
      filters: OrderFilters
    ): OrderConnection!
    
    order(shopDomain: String!, shopifyId: String!): Order
    
    orderStats(shopDomain: String!): OrderStats!
  }

  type Mutation {
    createOrder(shopDomain: String!, input: CreateOrderInput!): Order!
    updateOrder(shopDomain: String!, shopifyId: String!, input: UpdateOrderInput!): Order!
    cancelOrder(shopDomain: String!, shopifyId: String!): Order!
  }
`;


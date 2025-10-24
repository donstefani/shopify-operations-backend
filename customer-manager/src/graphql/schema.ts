import gql from 'graphql-tag';

export const typeDefs = gql`
  type Customer {
    id: ID!
    shopifyId: String!
    shopDomain: String!
    email: String!
    firstName: String
    lastName: String
    phone: String
    totalSpent: Float!
    ordersCount: Int!
    state: CustomerState!
    syncStatus: SyncStatus!
    createdAt: String!
    updatedAt: String!
  }

  enum CustomerState {
    DISABLED
    INVITED
    ENABLED
    DECLINED
  }

  enum SyncStatus {
    PENDING
    SYNCED
    FAILED
  }

  type CustomerConnection {
    items: [Customer!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type CustomerStats {
    total: Int!
    totalLifetimeValue: Float!
    averageOrderValue: Float!
    byState: CustomerStateBreakdown!
  }

  type CustomerStateBreakdown {
    enabled: Int!
    disabled: Int!
    invited: Int!
    declined: Int!
  }

  input CreateCustomerInput {
    email: String!
    firstName: String
    lastName: String
    phone: String
    state: CustomerState
  }

  input UpdateCustomerInput {
    firstName: String
    lastName: String
    phone: String
    state: CustomerState
  }

  input CustomerFilters {
    state: CustomerState
    search: String
  }

  type Query {
    customers(
      shopDomain: String!
      limit: Int = 20
      cursor: String
      filters: CustomerFilters
    ): CustomerConnection!
    
    customer(shopDomain: String!, shopifyId: String!): Customer
    
    customerStats(shopDomain: String!): CustomerStats!
  }

  type Mutation {
    createCustomer(shopDomain: String!, input: CreateCustomerInput!): Customer!
    updateCustomer(shopDomain: String!, shopifyId: String!, input: UpdateCustomerInput!): Customer!
    deleteCustomer(shopDomain: String!, shopifyId: String!): Boolean!
  }
`;


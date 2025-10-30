import gql from 'graphql-tag';

export const typeDefs = gql`
  type Product {
    id: ID!
    shopifyId: String!
    shopDomain: String!
    title: String!
    handle: String!
    vendor: String
    productType: String
    tags: [String!]
    price: Float
    inventoryQuantity: Int
    status: ProductStatus!
    syncStatus: SyncStatus!
    createdAt: String!
    updatedAt: String!
  }

  enum ProductStatus {
    ACTIVE
    DRAFT
    ARCHIVED
  }

  enum SyncStatus {
    PENDING
    SYNCED
    FAILED
  }

  type ProductConnection {
    items: [Product!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type ProductStats {
    total: Int!
    byStatus: StatusBreakdown!
  }

  type StatusBreakdown {
    active: Int!
    draft: Int!
    archived: Int!
  }

  input CreateProductInput {
    title: String!
    handle: String!
    vendor: String
    productType: String
    tags: [String!]
    price: Float!
    inventoryQuantity: Int!
    status: ProductStatus!
  }

  input UpdateProductInput {
    title: String
    handle: String
    vendor: String
    productType: String
    tags: [String!]
    price: Float
    inventoryQuantity: Int
    status: ProductStatus
  }

  input ProductFilters {
    status: ProductStatus
    search: String
  }

  type Query {
    products(
      shopDomain: String!
      limit: Int = 20
      cursor: String
      filters: ProductFilters
    ): ProductConnection!
    
    product(shopDomain: String!, shopifyId: String!): Product
    
    productStats(shopDomain: String!): ProductStats!
  }

  type SyncResult {
    success: Boolean!
    message: String!
    imported: Int!
    updated: Int!
    errors: Int!
    details: [SyncDetail!]!
  }

  type SyncDetail {
    action: String!
    shopifyId: String!
    title: String!
    error: String
  }

  type Mutation {
    createProduct(shopDomain: String!, input: CreateProductInput!): Product!
    updateProduct(shopDomain: String!, shopifyId: String!, input: UpdateProductInput!): Product!
    deleteProduct(shopDomain: String!, shopifyId: String!): Boolean!
    syncAllProducts(shopDomain: String!): SyncResult!
  }
`;


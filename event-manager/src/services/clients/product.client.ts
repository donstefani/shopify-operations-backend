/**
 * Product GraphQL Client
 * 
 * Handles all product-related GraphQL operations for data synchronization.
 * Focused on basic CRUD operations to sync product data from Shopify to company database.
 */

import { BaseGraphQLClient } from '../core/graphql-client.service';
import { GraphQLRequest, GraphQLClientContext, GraphQLClientConfig } from '../../types/errors.types';

export class ProductClient extends BaseGraphQLClient {
  /**
   * Get a single product by ID
   */
  async getProduct(id: string, context: GraphQLClientContext, config?: Partial<GraphQLClientConfig>) {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          vendor
          productType
          status
          tags
          description
          descriptionHtml
          createdAt
          updatedAt
          publishedAt
          images(first: 50) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              price
              compareAtPrice
              sku
              barcode
              inventoryQuantity
              weight
              weightUnit
              requiresShipping
              taxable
              inventoryItem {
                id
                sku
                tracked
                countryCodeOfOrigin
                harmonizedSystemCode
                provinceCodeOfOrigin
              }
            }
          }
          options {
            id
            name
            values
          }
          metafields(first: 50) {
            nodes {
              id
              namespace
              key
              value
              type
              description
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { id }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get multiple products with pagination
   */
  async getProducts(
    first: number = 50, 
    after?: string, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          nodes {
            id
            title
            handle
            vendor
            productType
            status
            tags
            createdAt
            updatedAt
            publishedAt
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { first, after }
    };

    if (!context) {
      throw new Error('Context is required for getProducts operation');
    }

    return this.executeQuery(request, context, config);
  }

  /**
   * Get product variants for a specific product
   */
  async getProductVariants(
    productId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getProductVariants($productId: ID!) {
        product(id: $productId) {
          id
          variants(first: 100) {
            nodes {
              id
              title
              price
              compareAtPrice
              sku
              barcode
              inventoryQuantity
              weight
              weightUnit
              requiresShipping
              taxable
              inventoryItem {
                id
                sku
                tracked
                countryCodeOfOrigin
                harmonizedSystemCode
                provinceCodeOfOrigin
              }
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { productId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get product images for a specific product
   */
  async getProductImages(
    productId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getProductImages($productId: ID!) {
        product(id: $productId) {
          id
          images(first: 50) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { productId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get product metafields
   */
  async getProductMetafields(
    productId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getProductMetafields($productId: ID!) {
        product(id: $productId) {
          id
          metafields(first: 50) {
            nodes {
              id
              namespace
              key
              value
              type
              description
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { productId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Search products by query
   */
  async searchProducts(
    query: string, 
    first: number = 20, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const graphqlQuery = `
      query searchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          nodes {
            id
            title
            handle
            vendor
            productType
            status
            tags
            createdAt
            updatedAt
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query: graphqlQuery,
      variables: { query, first }
    };

    if (!context) {
      throw new Error('Context is required for searchProducts operation');
    }

    return this.executeQuery(request, context, config);
  }
}

// Export singleton instance
export const productClient = new ProductClient();

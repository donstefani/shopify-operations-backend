/**
 * Order GraphQL Client
 * 
 * Handles all order-related GraphQL operations for data synchronization.
 * Focused on basic CRUD operations to sync order data from Shopify to company database.
 */

import { BaseGraphQLClient } from '../core/graphql-client.service';
import { GraphQLRequest, GraphQLClientContext, GraphQLClientConfig } from '../../types/errors.types';

export class OrderClient extends BaseGraphQLClient {
  /**
   * Get a single order by ID
   */
  async getOrder(id: string, context: GraphQLClientContext, config?: Partial<GraphQLClientConfig>) {
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          email
          phone
          createdAt
          updatedAt
          processedAt
          cancelledAt
          closedAt
          totalPrice
          subtotalPrice
          totalTax
          totalShippingPrice
          totalDiscounts
          currencyCode
          financialStatus
          fulfillmentStatus
          tags
          note
          customerLocale
          customer {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
          }
          shippingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          billingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          lineItems(first: 100) {
            nodes {
              id
              title
              quantity
              price
              originalPrice
              discountedPrice
              variant {
                id
                title
                sku
                price
                compareAtPrice
                product {
                  id
                  title
                  handle
                }
              }
            }
          }
          fulfillments {
            id
            status
            trackingCompany
            trackingNumbers
            createdAt
            updatedAt
            fulfillmentLineItems(first: 100) {
              nodes {
                id
                quantity
                lineItem {
                  id
                  title
                  variant {
                    id
                    title
                    sku
                  }
                }
              }
            }
          }
          transactions {
            id
            kind
            status
            amount
            currency
            gateway
            createdAt
            processedAt
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
   * Get multiple orders with pagination
   */
  async getOrders(
    first: number = 50, 
    after?: string, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after) {
          nodes {
            id
            name
            email
            phone
            createdAt
            updatedAt
            processedAt
            totalPrice
            currencyCode
            financialStatus
            fulfillmentStatus
            tags
            customer {
              id
              email
              firstName
              lastName
            }
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
      throw new Error('Context is required for getOrders operation');
    }

    return this.executeQuery(request, context, config);
  }

  /**
   * Get order line items for a specific order
   */
  async getOrderLineItems(
    orderId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getOrderLineItems($orderId: ID!) {
        order(id: $orderId) {
          id
          lineItems(first: 100) {
            nodes {
              id
              title
              quantity
              price
              originalPrice
              discountedPrice
              variant {
                id
                title
                sku
                price
                compareAtPrice
                product {
                  id
                  title
                  handle
                }
              }
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { orderId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get order fulfillments
   */
  async getOrderFulfillments(
    orderId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getOrderFulfillments($orderId: ID!) {
        order(id: $orderId) {
          id
          fulfillments {
            id
            status
            trackingCompany
            trackingNumbers
            createdAt
            updatedAt
            fulfillmentLineItems(first: 100) {
              nodes {
                id
                quantity
                lineItem {
                  id
                  title
                  variant {
                    id
                    title
                    sku
                  }
                }
              }
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { orderId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get order transactions
   */
  async getOrderTransactions(
    orderId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getOrderTransactions($orderId: ID!) {
        order(id: $orderId) {
          id
          transactions {
            id
            kind
            status
            amount
            currency
            gateway
            createdAt
            processedAt
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { orderId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Search orders by query
   */
  async searchOrders(
    query: string, 
    first: number = 20, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const graphqlQuery = `
      query searchOrders($query: String!, $first: Int!) {
        orders(first: $first, query: $query) {
          nodes {
            id
            name
            email
            phone
            createdAt
            updatedAt
            totalPrice
            currencyCode
            financialStatus
            fulfillmentStatus
            customer {
              id
              email
              firstName
              lastName
            }
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
      throw new Error('Context is required for searchOrders operation');
    }

    return this.executeQuery(request, context, config);
  }

  /**
   * Get orders by customer ID
   */
  async getOrdersByCustomer(
    customerId: string, 
    first: number = 50, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getOrdersByCustomer($customerId: ID!, $first: Int!) {
        customer(id: $customerId) {
          id
          orders(first: $first) {
            nodes {
              id
              name
              email
              phone
              createdAt
              updatedAt
              totalPrice
              currencyCode
              financialStatus
              fulfillmentStatus
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { customerId, first }
    };

    if (!context) {
      throw new Error('Context is required for getOrdersByCustomer operation');
    }

    return this.executeQuery(request, context, config);
  }
}

// Export singleton instance
export const orderClient = new OrderClient();

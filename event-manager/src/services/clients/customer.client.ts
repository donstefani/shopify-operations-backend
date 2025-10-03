/**
 * Customer GraphQL Client
 * 
 * Handles all customer-related GraphQL operations for data synchronization.
 * Focused on basic CRUD operations to sync customer data from Shopify to company database.
 */

import { BaseGraphQLClient } from '../core/graphql-client.service';
import { GraphQLRequest, GraphQLClientContext, GraphQLClientConfig } from '../../types/errors.types';

export class CustomerClient extends BaseGraphQLClient {
  /**
   * Get a single customer by ID
   */
  async getCustomer(id: string, context: GraphQLClientContext, config?: Partial<GraphQLClientConfig>) {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          acceptsMarketing
          acceptsMarketingUpdatedAt
          createdAt
          updatedAt
          defaultAddress {
            id
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
          addresses(first: 50) {
            nodes {
              id
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
          tags
          state
          note
          verifiedEmail
          multipassIdentifier
          taxExempt
          taxExemptions
          totalSpent
          ordersCount
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
   * Get multiple customers with pagination
   */
  async getCustomers(
    first: number = 50, 
    after?: string, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomers($first: Int!, $after: String) {
        customers(first: $first, after: $after) {
          nodes {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
            totalSpent
            ordersCount
            tags
            state
            verifiedEmail
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
      throw new Error('Context is required for getCustomers operation');
    }

    return this.executeQuery(request, context, config);
  }

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(
    customerId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomerAddresses($customerId: ID!) {
        customer(id: $customerId) {
          id
          addresses(first: 50) {
            nodes {
              id
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
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { customerId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get customer metafields
   */
  async getCustomerMetafields(
    customerId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomerMetafields($customerId: ID!) {
        customer(id: $customerId) {
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
      variables: { customerId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get customer orders summary
   */
  async getCustomerOrdersSummary(
    customerId: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomerOrdersSummary($customerId: ID!) {
        customer(id: $customerId) {
          id
          totalSpent
          ordersCount
          orders(first: 10) {
            nodes {
              id
              name
              createdAt
              totalPrice
              currencyCode
              financialStatus
              fulfillmentStatus
            }
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { customerId }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Search customers by query
   */
  async searchCustomers(
    query: string, 
    first: number = 20, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const graphqlQuery = `
      query searchCustomers($query: String!, $first: Int!) {
        customers(first: $first, query: $query) {
          nodes {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
            totalSpent
            ordersCount
            tags
            state
            verifiedEmail
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
      throw new Error('Context is required for searchCustomers operation');
    }

    return this.executeQuery(request, context, config);
  }

  /**
   * Get customers by email
   */
  async getCustomerByEmail(
    email: string, 
    context: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomerByEmail($email: String!) {
        customers(first: 1, query: $email) {
          nodes {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
            totalSpent
            ordersCount
            tags
            state
            verifiedEmail
          }
        }
      }
    `;

    const request: GraphQLRequest = {
      query,
      variables: { email }
    };

    return this.executeQuery(request, context, config);
  }

  /**
   * Get customers by tag
   */
  async getCustomersByTag(
    tag: string, 
    first: number = 50, 
    context?: GraphQLClientContext, 
    config?: Partial<GraphQLClientConfig>
  ) {
    const query = `
      query getCustomersByTag($tag: String!, $first: Int!) {
        customers(first: $first, query: $tag) {
          nodes {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
            totalSpent
            ordersCount
            tags
            state
            verifiedEmail
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
      variables: { tag, first }
    };

    if (!context) {
      throw new Error('Context is required for getCustomersByTag operation');
    }

    return this.executeQuery(request, context, config);
  }
}

// Export singleton instance
export const customerClient = new CustomerClient();

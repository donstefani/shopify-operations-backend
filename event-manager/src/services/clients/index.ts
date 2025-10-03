/**
 * GraphQL Clients Index
 * 
 * Central export point for all domain-specific GraphQL clients.
 * These clients handle data synchronization from Shopify to company database.
 */

export { BaseGraphQLClient, baseGraphQLClient } from '../core/graphql-client.service';
export { ProductClient, productClient } from './product.client';
export { OrderClient, orderClient } from './order.client';
export { CustomerClient, customerClient } from './customer.client';

// Future clients will be exported here:
// export { CollectionClient, collectionClient } from './collection.client';
// export { InventoryClient, inventoryClient } from './inventory.client';
// export { WebhookClient, webhookClient } from './webhook.client';

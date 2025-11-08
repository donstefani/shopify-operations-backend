import { DynamoDBService } from './dynamodb.service';
import { ShopifySyncService } from './shopify-sync.service';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  ProductConnection,
  ProductStats,
  ProductStatus,
  SyncStatus,
} from '../types';

/**
 * Main business logic service for products
 */
export class ProductService {
  private dynamoDBService: DynamoDBService;
  private shopifySyncService: ShopifySyncService;

  constructor() {
    this.dynamoDBService = new DynamoDBService();
    this.shopifySyncService = new ShopifySyncService();
  }

  /**
   * List products with pagination and filters
   */
  async listProducts(
    shopDomain: string,
    limit: number = 20,
    cursor?: string,
    filters?: ProductFilters
  ): Promise<ProductConnection> {
    let exclusiveStartKey: Record<string, any> | undefined;

    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch (error) {
        console.error('Invalid cursor:', error);
      }
    }

    const result = await this.dynamoDBService.listProducts(
      shopDomain,
      limit,
      exclusiveStartKey,
      filters
    );

    const endCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      items: result.items,
      pageInfo: {
        hasNextPage: !!result.lastEvaluatedKey,
        endCursor,
      },
      totalCount: result.totalCount,
    };
  }

  /**
   * Get a single product
   */
  async getProduct(shopDomain: string, shopifyId: string): Promise<Product | null> {
    return this.dynamoDBService.getProduct(shopDomain, shopifyId);
  }

  /**
   * Create a new product
   */
  async createProduct(shopDomain: string, input: CreateProductInput): Promise<Product> {
    const now = new Date().toISOString();
    const tempId = `PRODUCT#${Date.now()}`;

    // Step 1: Create in DynamoDB with pending sync status
    const product: Product = {
      id: tempId,
      shopifyId: '', // Will be updated after Shopify sync
      shopDomain,
      title: input.title,
      handle: input.handle,
      vendor: input.vendor,
      productType: input.productType,
      tags: input.tags,
      price: input.price,
      inventoryQuantity: input.inventoryQuantity,
      status: input.status || ProductStatus.DRAFT,
      syncStatus: SyncStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoDBService.createProduct(product);

    // Step 2: Sync to Shopify
    try {
      const { shopifyId } = await this.shopifySyncService.createProduct(shopDomain, input);
      
      // Step 3: Update DynamoDB with Shopify ID and synced status
      const updatedProduct = await this.dynamoDBService.updateProduct(shopDomain, shopifyId, {
        shopifyId,
        syncStatus: SyncStatus.SYNCED,
      });

      // Delete the temporary product
      await this.dynamoDBService.deleteProduct(shopDomain, tempId.replace('PRODUCT#', ''));

      // Update with proper ID
      const finalProduct: Product = {
        ...updatedProduct,
        id: `PRODUCT#${shopifyId}`,
        shopifyId,
      };

      await this.dynamoDBService.createProduct(finalProduct);

      return finalProduct;
    } catch (error) {
      console.error('Error syncing product to Shopify:', error);
      
      // Update sync status to failed
      await this.dynamoDBService.updateProduct(shopDomain, tempId.replace('PRODUCT#', ''), {
        syncStatus: SyncStatus.FAILED,
      });

      throw new Error(`Failed to sync product to Shopify: ${error}`);
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    shopDomain: string,
    shopifyId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    // Step 1: Update in DynamoDB with pending sync status
    await this.dynamoDBService.updateProduct(shopDomain, shopifyId, {
      ...input,
      syncStatus: SyncStatus.PENDING,
    });

    // Step 2: Sync to Shopify
    try {
      await this.shopifySyncService.updateProduct(shopDomain, shopifyId, input);
      
      // Step 3: Update sync status to synced
      const updatedProduct = await this.dynamoDBService.updateProduct(shopDomain, shopifyId, {
        syncStatus: SyncStatus.SYNCED,
      });

      return updatedProduct;
    } catch (error) {
      console.error('Error syncing product update to Shopify:', error);
      
      // Update sync status to failed
      await this.dynamoDBService.updateProduct(shopDomain, shopifyId, {
        syncStatus: SyncStatus.FAILED,
      });

      throw new Error(`Failed to sync product update to Shopify: ${error}`);
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(shopDomain: string, shopifyId: string): Promise<boolean> {
    try {
      // Step 1: Delete from Shopify first
      await this.shopifySyncService.deleteProduct(shopDomain, shopifyId);
      
      // Step 2: Delete from DynamoDB
      await this.dynamoDBService.deleteProduct(shopDomain, shopifyId);

      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw new Error(`Failed to delete product: ${error}`);
    }
  }

  /**
   * Get product statistics
   */
  async getProductStats(shopDomain: string): Promise<ProductStats> {
    return this.dynamoDBService.getProductStats(shopDomain);
  }

  /**
   * Sync all products from Shopify to DynamoDB
   * This is used for initial import or full resync
   */
  async syncAllProducts(shopDomain: string): Promise<{
    success: boolean;
    message: string;
    imported: number;
    updated: number;
    errors: number;
    details: any[];
  }> {
    console.log(`🚀 Starting bulk product sync for shop: ${shopDomain}`);
    
    let imported = 0;
    let updated = 0;
    let errors = 0;
    const details: any[] = [];

    try {
      // Step 1: Fetch all products from Shopify
      const shopifyProducts = await this.shopifySyncService.getAllProducts(shopDomain);
      
      if (shopifyProducts.length === 0) {
        return {
          success: true,
          message: 'No products found in Shopify store',
          imported: 0,
          updated: 0,
          errors: 0,
          details: [],
        };
      }

      console.log(`📦 Found ${shopifyProducts.length} products in Shopify`);

      // Step 2: Process each product
      for (const shopifyProduct of shopifyProducts) {
        try {
          const shopifyId = shopifyProduct.id.replace('gid://shopify/Product/', '');
          
          // Check if product already exists in DynamoDB
          const existingProduct = await this.dynamoDBService.getProduct(shopDomain, shopifyId);
          
          // Extract price and inventory from first variant
          const firstVariant = shopifyProduct.variants?.nodes?.[0];
          const price = firstVariant?.price ? parseFloat(firstVariant.price) : 0;
          const inventoryQuantity = firstVariant?.inventoryQuantity || 0;

          const productData: Product = {
            id: `PRODUCT#${shopifyId}`,
            shopifyId,
            shopDomain,
            title: shopifyProduct.title,
            handle: shopifyProduct.handle,
            vendor: shopifyProduct.vendor || '',
            productType: shopifyProduct.productType || '',
            tags: shopifyProduct.tags || [],
            price,
            inventoryQuantity,
            status: this.mapShopifyStatus(shopifyProduct.status),
            syncStatus: SyncStatus.SYNCED,
            createdAt: shopifyProduct.createdAt,
            updatedAt: shopifyProduct.updatedAt,
          };

          if (existingProduct) {
            // Update existing product
            await this.dynamoDBService.updateProduct(shopDomain, shopifyId, {
              title: productData.title,
              handle: productData.handle,
              vendor: productData.vendor,
              productType: productData.productType,
              tags: productData.tags,
              price: productData.price,
              inventoryQuantity: productData.inventoryQuantity,
              status: productData.status,
              syncStatus: SyncStatus.SYNCED,
              updatedAt: new Date().toISOString(),
            });
            updated++;
            details.push({
              action: 'updated',
              shopifyId,
              title: productData.title,
            });
          } else {
            // Create new product
            await this.dynamoDBService.createProduct(productData);
            imported++;
            details.push({
              action: 'imported',
              shopifyId,
              title: productData.title,
            });
          }

          console.log(`✅ Processed product: ${productData.title} (${existingProduct ? 'updated' : 'imported'})`);

        } catch (error) {
          console.error(`❌ Error processing product ${shopifyProduct.title}:`, error);
          errors++;
          details.push({
            action: 'error',
            shopifyId: shopifyProduct.id,
            title: shopifyProduct.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const message = `Bulk sync completed: ${imported} imported, ${updated} updated, ${errors} errors`;
      console.log(`🎉 ${message}`);

      return {
        success: errors === 0,
        message,
        imported,
        updated,
        errors,
        details,
      };

    } catch (error) {
      console.error('❌ Bulk sync failed:', error);
      return {
        success: false,
        message: `Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        imported,
        updated,
        errors: errors + 1,
        details,
      };
    }
  }

  /**
   * Map Shopify product status to our ProductStatus enum
   */
  private mapShopifyStatus(shopifyStatus: string): ProductStatus {
    switch (shopifyStatus?.toUpperCase()) {
      case 'ACTIVE':
        return ProductStatus.ACTIVE;
      case 'DRAFT':
        return ProductStatus.DRAFT;
      case 'ARCHIVED':
        return ProductStatus.ARCHIVED;
      default:
        return ProductStatus.DRAFT;
    }
  }
}


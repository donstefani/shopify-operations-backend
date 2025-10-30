import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { TokenService } from './token.service';
import { Product, CreateProductInput, UpdateProductInput } from '../types';

/**
 * Service for syncing products with Shopify GraphQL API
 */
export class ShopifySyncService {
  private tokenService: TokenService;
  private shopify: any;

  constructor() {
    this.tokenService = new TokenService();
    
    this.shopify = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY || '',
      apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
      scopes: ['read_products', 'write_products'],
      hostName: 'localhost',
      apiVersion: ApiVersion.July25,
      isEmbeddedApp: false,
    });
  }

  /**
   * Get Shopify GraphQL client for a shop
   */
  private async getClient(shopDomain: string) {
    const tokenData = await this.tokenService.getAccessToken(shopDomain);
    
    if (!tokenData) {
      throw new Error(`No access token found for shop: ${shopDomain}`);
    }

    const session = new Session({
      id: `offline_${shopDomain}`,
      shop: shopDomain,
      state: 'online',
      isOnline: false,
      accessToken: tokenData.accessToken,
    });

    return new this.shopify.clients.Graphql({ session });
  }

  /**
   * Create a product in Shopify
   */
  async createProduct(shopDomain: string, input: CreateProductInput): Promise<{ shopifyId: string }> {
    const client = await this.getClient(shopDomain);

    const mutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        title: input.title,
        handle: input.handle,
        vendor: input.vendor,
        productType: input.productType,
        tags: input.tags,
        status: input.status,
        variants: [
          {
            price: input.price?.toString(),
            inventoryQuantities: input.inventoryQuantity ? [
              {
                availableQuantity: input.inventoryQuantity,
                locationId: 'gid://shopify/Location/1', // Default location
              },
            ] : undefined,
          },
        ],
      },
    };

    try {
      const response = await client.query({
        data: {
          query: mutation,
          variables,
        },
      });

      const data = response.body as any;

      if (data.data?.productCreate?.userErrors?.length > 0) {
        const errors = data.data.productCreate.userErrors;
        throw new Error(`Shopify error: ${errors.map((e: any) => e.message).join(', ')}`);
      }

      const shopifyId = data.data.productCreate.product.id.split('/').pop();
      return { shopifyId };
    } catch (error) {
      console.error('Error creating product in Shopify:', error);
      throw error;
    }
  }

  /**
   * Update a product in Shopify
   */
  async updateProduct(
    shopDomain: string,
    shopifyId: string,
    input: UpdateProductInput
  ): Promise<void> {
    const client = await this.getClient(shopDomain);

    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const productInput: any = {
      id: `gid://shopify/Product/${shopifyId}`,
    };

    if (input.title) productInput.title = input.title;
    if (input.handle) productInput.handle = input.handle;
    if (input.vendor) productInput.vendor = input.vendor;
    if (input.productType) productInput.productType = input.productType;
    if (input.tags) productInput.tags = input.tags;
    if (input.status) productInput.status = input.status;

    // Handle price and inventory updates separately if needed
    if (input.price !== undefined) {
      productInput.variants = [
        {
          price: input.price.toString(),
        },
      ];
    }

    const variables = {
      input: productInput,
    };

    try {
      const response = await client.query({
        data: {
          query: mutation,
          variables,
        },
      });

      const data = response.body as any;

      if (data.data?.productUpdate?.userErrors?.length > 0) {
        const errors = data.data.productUpdate.userErrors;
        throw new Error(`Shopify error: ${errors.map((e: any) => e.message).join(', ')}`);
      }
    } catch (error) {
      console.error('Error updating product in Shopify:', error);
      throw error;
    }
  }

  /**
   * Get all products from Shopify (for bulk import)
   */
  async getAllProducts(shopDomain: string): Promise<any[]> {
    const client = await this.getClient(shopDomain);
    const allProducts: any[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

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
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    try {
      while (hasNextPage) {
        const variables = {
          first: 50, // Shopify's max for products
          after: cursor,
        };

        const response = await client.query({
          data: {
            query,
            variables,
          },
        });

        const data = response.body as any;
        const products = data.data?.products?.nodes || [];
        const pageInfo = data.data?.products?.pageInfo;

        allProducts.push(...products);
        
        hasNextPage = pageInfo?.hasNextPage || false;
        cursor = pageInfo?.endCursor || null;

        console.log(`📦 Fetched ${products.length} products. Total: ${allProducts.length}`);
        
        // Add a small delay to respect rate limits
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Successfully fetched ${allProducts.length} products from Shopify`);
      return allProducts;
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
      throw error;
    }
  }

  /**
   * Delete a product in Shopify
   */
  async deleteProduct(shopDomain: string, shopifyId: string): Promise<void> {
    const client = await this.getClient(shopDomain);

    const mutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: `gid://shopify/Product/${shopifyId}`,
      },
    };

    try {
      const response = await client.query({
        data: {
          query: mutation,
          variables,
        },
      });

      const data = response.body as any;

      if (data.data?.productDelete?.userErrors?.length > 0) {
        const errors = data.data.productDelete.userErrors;
        throw new Error(`Shopify error: ${errors.map((e: any) => e.message).join(', ')}`);
      }
    } catch (error) {
      console.error('Error deleting product in Shopify:', error);
      throw error;
    }
  }
}


import { ProductService } from '../../services/product.service';
import {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  ProductFiltersSchema,
} from '../../utils/validation';

const productService = new ProductService();

export const resolvers = {
  Query: {
    products: async (
      _parent: any,
      { shopDomain, limit, cursor, filters }: any,
      _context: any
    ) => {
      try {
        // Validate filters if provided
        if (filters) {
          ProductFiltersSchema.parse(filters);
        }

        return await productService.listProducts(shopDomain, limit, cursor, filters);
      } catch (error) {
        console.error('Error fetching products:', error);
        throw new Error(`Failed to fetch products: ${error}`);
      }
    },

    product: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await productService.getProduct(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error fetching product:', error);
        throw new Error(`Failed to fetch product: ${error}`);
      }
    },

    productStats: async (_parent: any, { shopDomain }: any, _context: any) => {
      try {
        return await productService.getProductStats(shopDomain);
      } catch (error) {
        console.error('Error fetching product stats:', error);
        throw new Error(`Failed to fetch product stats: ${error}`);
      }
    },
  },

  Mutation: {
    createProduct: async (_parent: any, { shopDomain, input }: any, _context: any) => {
      try {
        // Validate input
        CreateProductInputSchema.parse(input);

        return await productService.createProduct(shopDomain, input);
      } catch (error) {
        console.error('Error creating product:', error);
        throw new Error(`Failed to create product: ${error}`);
      }
    },

    updateProduct: async (
      _parent: any,
      { shopDomain, shopifyId, input }: any,
      _context: any
    ) => {
      try {
        // Validate input
        UpdateProductInputSchema.parse(input);

        return await productService.updateProduct(shopDomain, shopifyId, input);
      } catch (error) {
        console.error('Error updating product:', error);
        throw new Error(`Failed to update product: ${error}`);
      }
    },

    deleteProduct: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await productService.deleteProduct(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error deleting product:', error);
        throw new Error(`Failed to delete product: ${error}`);
      }
    },

    syncAllProducts: async (_parent: any, { shopDomain }: any, _context: any) => {
      try {
        console.log(`🔄 Starting bulk product sync for shop: ${shopDomain}`);
        const result = await productService.syncAllProducts(shopDomain);
        
        console.log(`✅ Bulk sync completed:`, {
          success: result.success,
          imported: result.imported,
          updated: result.updated,
          errors: result.errors,
        });
        
        return result;
      } catch (error) {
        console.error('Error syncing all products:', error);
        throw new Error(`Failed to sync products: ${error}`);
      }
    },
  },
};


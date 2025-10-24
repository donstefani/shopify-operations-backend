import { z } from 'zod';

export const CreateProductInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  handle: z.string().min(1, 'Handle is required'),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  inventoryQuantity: z.number().int().min(0, 'Inventory must be non-negative'),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']),
});

export const UpdateProductInputSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().min(0).optional(),
  inventoryQuantity: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
});

export const ProductFiltersSchema = z.object({
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  search: z.string().optional(),
});


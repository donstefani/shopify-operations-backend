import { CustomerService } from '../../services/customer.service';

const customerService = new CustomerService();

export const resolvers = {
  Query: {
    customers: async (_parent: any, { shopDomain, limit, cursor, filters }: any, _context: any) => {
      try {
        return await customerService.listCustomers(shopDomain, limit, cursor, filters);
      } catch (error) {
        console.error('Error fetching customers:', error);
        throw new Error(`Failed to fetch customers: ${error}`);
      }
    },

    customer: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await customerService.getCustomer(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error fetching customer:', error);
        throw new Error(`Failed to fetch customer: ${error}`);
      }
    },

    customerStats: async (_parent: any, { shopDomain }: any, _context: any) => {
      try {
        return await customerService.getCustomerStats(shopDomain);
      } catch (error) {
        console.error('Error fetching customer stats:', error);
        throw new Error(`Failed to fetch customer stats: ${error}`);
      }
    },
  },

  Mutation: {
    createCustomer: async (_parent: any, { shopDomain, input }: any, _context: any) => {
      try {
        return await customerService.createCustomer(shopDomain, input);
      } catch (error) {
        console.error('Error creating customer:', error);
        throw new Error(`Failed to create customer: ${error}`);
      }
    },

    updateCustomer: async (_parent: any, { shopDomain, shopifyId, input }: any, _context: any) => {
      try {
        return await customerService.updateCustomer(shopDomain, shopifyId, input);
      } catch (error) {
        console.error('Error updating customer:', error);
        throw new Error(`Failed to update customer: ${error}`);
      }
    },

    deleteCustomer: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await customerService.deleteCustomer(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error deleting customer:', error);
        throw new Error(`Failed to delete customer: ${error}`);
      }
    },
  },
};


import { OrderService } from '../../services/order.service';

const orderService = new OrderService();

export const resolvers = {
  Query: {
    orders: async (_parent: any, { shopDomain, limit, cursor, filters }: any, _context: any) => {
      try {
        return await orderService.listOrders(shopDomain, limit, cursor, filters);
      } catch (error) {
        console.error('Error fetching orders:', error);
        throw new Error(`Failed to fetch orders: ${error}`);
      }
    },

    order: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await orderService.getOrder(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error fetching order:', error);
        throw new Error(`Failed to fetch order: ${error}`);
      }
    },

    orderStats: async (_parent: any, { shopDomain }: any, _context: any) => {
      try {
        return await orderService.getOrderStats(shopDomain);
      } catch (error) {
        console.error('Error fetching order stats:', error);
        throw new Error(`Failed to fetch order stats: ${error}`);
      }
    },
  },

  Mutation: {
    createOrder: async (_parent: any, { shopDomain, input }: any, _context: any) => {
      try {
        return await orderService.createOrder(shopDomain, input);
      } catch (error) {
        console.error('Error creating order:', error);
        throw new Error(`Failed to create order: ${error}`);
      }
    },

    updateOrder: async (_parent: any, { shopDomain, shopifyId, input }: any, _context: any) => {
      try {
        return await orderService.updateOrder(shopDomain, shopifyId, input);
      } catch (error) {
        console.error('Error updating order:', error);
        throw new Error(`Failed to update order: ${error}`);
      }
    },

    cancelOrder: async (_parent: any, { shopDomain, shopifyId }: any, _context: any) => {
      try {
        return await orderService.cancelOrder(shopDomain, shopifyId);
      } catch (error) {
        console.error('Error cancelling order:', error);
        throw new Error(`Failed to cancel order: ${error}`);
      }
    },
  },
};


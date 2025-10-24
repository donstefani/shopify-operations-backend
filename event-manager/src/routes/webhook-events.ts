import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WebhookEventDynamoDBService } from '../services/dynamodb/webhook-event.service';

const router = Router();
const webhookEventService = new WebhookEventDynamoDBService();

// Validation schemas
const WebhookEventsQuerySchema = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  limit: z.coerce.number().min(1).max(100).default(50),
  topic: z.string().optional(),
  cursor: z.string().optional()
});

/**
 * Get webhook events for a specific shop
 * GET /api/events?shop=domain.com&limit=50&topic=orders/create
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = WebhookEventsQuerySchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validationResult.error.issues.map((e: any) => e.message).join(', ')
      });
    }

    const { shop, limit, topic } = validationResult.data;
    
    let result;
    if (topic) {
      // Get events by topic
      result = await webhookEventService.getWebhookEventsByTopic(topic, limit);
    } else {
      // Get events by shop
      result = await webhookEventService.getWebhookEventsByShop(shop, limit);
    }
    
    if (result.success) {
      // Add status field for UI compatibility
      const eventsWithStatus = result.data?.map(event => ({
        ...event,
        status: 'processed' // All events in database are considered processed
      })) || [];

      return res.json({
        success: true,
        message: `Retrieved ${eventsWithStatus.length} webhook events`,
        data: eventsWithStatus,
        pagination: {
          limit,
          hasMore: eventsWithStatus.length === limit
        }
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Webhook events retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve webhook events'
    });
  }
});

/**
 * Get webhook event statistics for a shop
 * GET /api/events/stats?shop=domain.com
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }

    // Get recent events to calculate stats
    const recentEvents = await webhookEventService.getWebhookEventsByShop(shop, 100);
    
    if (!recentEvents.success || !recentEvents.data) {
      return res.status(400).json(recentEvents);
    }

    // Calculate statistics
    const events = recentEvents.data;
    const eventsWithStatus = events.map(event => ({
      ...event,
      status: 'processed' // All events in database are considered processed
    }));

    const stats = {
      total: eventsWithStatus.length,
      byTopic: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      recent: eventsWithStatus.slice(0, 10), // Last 10 events
      lastEvent: eventsWithStatus[0]?.created_at || null
    };

      // Count by topic and status
      eventsWithStatus.forEach(event => {
        // Count by topic
        stats.byTopic[event.topic] = (stats.byTopic[event.topic] || 0) + 1;
        
        // Count by status
        stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;
      });

    return res.json({
      success: true,
      message: 'Webhook event statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Webhook events stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve webhook event statistics'
    });
  }
});

/**
 * Get a specific webhook event by ID
 * GET /api/events/:id?shop=domain.com
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    const eventId = req.params['id'];
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        message: 'Please provide a valid event ID'
      });
    }

    // For now, we'll get events by shop and filter by ID
    // In a real implementation, you'd want a direct lookup by ID
    const result = await webhookEventService.getWebhookEventsByShop(shop, 1000);
    
    if (!result.success || !result.data) {
      return res.status(400).json(result);
    }

    const event = result.data.find(e => e.event_id === eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: `No webhook event found with ID: ${eventId}`
      });
    }

    return res.json({
      success: true,
      message: 'Webhook event retrieved successfully',
      data: event
    });
  } catch (error) {
    console.error('Webhook event retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve webhook event'
    });
  }
});

export default router;

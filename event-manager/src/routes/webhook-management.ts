import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WebhookService } from '../services/index';
import { WebhookRegistration } from '../types/webhook.types';
import EventManagerDatabaseService from '../services/database.service';

const router = Router();
const webhookService = new WebhookService();
const dbService = new EventManagerDatabaseService();

// Validation schemas
const WebhookRegistrationSchema = z.object({
  topic: z.string().min(1, 'Webhook topic is required'),
  address: z.string().url('Valid webhook URL is required'),
  format: z.enum(['json', 'xml']).default('json'),
  fields: z.array(z.string()).optional(),
  metafield_namespaces: z.array(z.string()).optional(),
  private_metafield_namespaces: z.array(z.string()).optional()
});

/**
 * Register a new webhook with Shopify
 * POST /api/webhooks/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }

    // Validate request body
    const validationResult = WebhookRegistrationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validationResult.error.issues.map((e: any) => e.message).join(', ')
      });
    }

    const webhookData: WebhookRegistration = {
      topic: validationResult.data.topic,
      address: validationResult.data.address,
      format: validationResult.data.format,
      ...(validationResult.data.fields && { fields: validationResult.data.fields }),
      ...(validationResult.data.metafield_namespaces && { metafield_namespaces: validationResult.data.metafield_namespaces }),
      ...(validationResult.data.private_metafield_namespaces && { private_metafield_namespaces: validationResult.data.private_metafield_namespaces })
    };
    
    // Register webhook using stored token
    const result = await webhookService.registerWebhook(shop, webhookData);
    
    if (result.success) {
      // Store webhook registration in database
      try {
        await dbService.connect();
        await dbService.createRegisteredWebhook({
          shop_domain: shop,
          topic: webhookData.topic,
          webhook_url: webhookData.address,
          webhook_id: result.data?.id || 0,
          status: 'active'
        });
        console.log(`✅ Webhook registered and stored in database for shop: ${shop}, topic: ${webhookData.topic}`);
      } catch (dbError) {
        console.error('Failed to store webhook registration in database:', dbError);
        // Don't fail the request if database storage fails
      }
      
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Webhook registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to register webhook'
    });
  }
});

/**
 * List all registered webhooks
 * GET /api/webhooks/list
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }

    // Get webhooks from both Shopify and our database
    const shopifyResult = await webhookService.listWebhooks(shop);
    
    // Also get webhooks from our database
    let dbWebhooks: any[] = [];
    try {
      await dbService.connect();
      dbWebhooks = await dbService.getRegisteredWebhooksByShop(shop);
    } catch (dbError) {
      console.error('Failed to get webhooks from database:', dbError);
    }
    
    if (shopifyResult.success) {
      return res.json({
        ...shopifyResult,
        database_webhooks: dbWebhooks,
        message: `Found ${shopifyResult.data?.length || 0} webhooks from Shopify and ${dbWebhooks.length} from database`
      });
    } else {
      return res.status(400).json(shopifyResult);
    }
  } catch (error) {
    console.error('Webhook listing error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve webhooks'
    });
  }
});

/**
 * Get a specific webhook by ID
 * GET /api/webhooks/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    const webhookId = parseInt(req.params['id'] || '0');
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }
    
    if (isNaN(webhookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook ID',
        message: 'Webhook ID must be a number'
      });
    }

    const result = await webhookService.getWebhook(shop, webhookId);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('Webhook retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve webhook'
    });
  }
});

/**
 * Delete a webhook by ID
 * DELETE /api/webhooks/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { shop } = req.query;
    const webhookId = parseInt(req.params['id'] || '0');
    
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide shop domain in query parameter'
      });
    }
    
    if (isNaN(webhookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook ID',
        message: 'Webhook ID must be a number'
      });
    }

    const result = await webhookService.deleteWebhook(shop, webhookId);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('Webhook deletion error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to delete webhook'
    });
  }
});

export default router;

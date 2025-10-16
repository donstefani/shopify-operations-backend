import { Router, Response } from 'express';
import { webhookHandlerRegistry } from '../services/index';
import { WebhookRequest } from '../types/index';

const router = Router();


/**
 * Handle incoming webhook events with slashes (e.g., products/create)
 * POST /webhooks/:topic/:action
 */
router.post('/:topic/:action', async (req: WebhookRequest, res: Response) => {
  try {
    // Set webhook topic from URL parameters if not already set by middleware
    if (!req.webhookTopic && req.params['topic'] && req.params['action']) {
      req.webhookTopic = `${req.params['topic']}/${req.params['action']}`;
    }
    
    // Set shop domain from headers if not already set
    if (!req.webhookShop) {
      req.webhookShop = req.get('X-Shopify-Shop-Domain') || req.get('x-shopify-shop-domain') || 'unknown';
    }
    
    // Set webhook ID from headers if not already set
    if (!req.webhookId) {
      req.webhookId = req.get('X-Shopify-Webhook-Id') || req.get('x-shopify-webhook-id');
    }
    
    console.log('Webhook route hit (with action):', req.webhookTopic, req.body);
    // Process webhook using the handler registry
    const result = await webhookHandlerRegistry.handleWebhook(req.body, req);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      console.error('Webhook processing failed:', result.message);
      res.status(200).json({
        success: false,
        error: 'Webhook processing failed',
        message: result.message
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

/**
 * Handle incoming webhook events
 * POST /webhooks/:topic
 */
router.post('/:topic', async (req: WebhookRequest, res: Response) => {
  try {
    // Set webhook topic from URL parameter if not already set by middleware
    if (!req.webhookTopic && req.params['topic']) {
      req.webhookTopic = req.params['topic'];
    }
    
    // Set shop domain from headers if not already set
    if (!req.webhookShop) {
      req.webhookShop = req.get('X-Shopify-Shop-Domain') || req.get('x-shopify-shop-domain') || 'unknown';
    }
    
    // Set webhook ID from headers if not already set
    if (!req.webhookId) {
      req.webhookId = req.get('X-Shopify-Webhook-Id') || req.get('x-shopify-webhook-id');
    }
    
    console.log('Webhook route hit:', req.params['topic'], req.body);
    // Process webhook using the handler registry
    const result = await webhookHandlerRegistry.handleWebhook(req.body, req);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      console.error('Webhook processing failed:', result.message);
      res.status(200).json({
        success: false,
        error: 'Webhook processing failed',
        message: result.message
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

export default router;

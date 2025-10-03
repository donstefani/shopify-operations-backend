import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { WebhookRequest } from '../types/index.js';

/**
 * Webhook Middleware
 * 
 * Handles raw body capture and HMAC verification for Shopify webhooks
 */

/**
 * Middleware to capture raw body for HMAC verification
 */
export const captureRawBody = (req: WebhookRequest, _res: Response, next: NextFunction): void => {
  if (req.method === 'POST' && req.path.includes('/webhooks/')) {
    let data = '';
    
    req.on('data', (chunk) => {
      data += chunk;
    });
    
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};

/**
 * HMAC verification middleware factory
 */
export const verifyWebhookHMAC = (secret: string) => {
  return (req: WebhookRequest, res: Response, next: NextFunction): void => {
    if (req.method !== 'POST' || !req.path.includes('/webhooks/')) {
      return next();
    }

    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const shop = req.get('X-Shopify-Shop-Domain');
    const topic = req.get('X-Shopify-Topic');
    const webhookId = req.get('X-Shopify-Webhook-Id');

    if (!hmac || !shop || !topic) {
      console.warn('Missing required webhook headers:', { hmac: !!hmac, shop: !!shop, topic: !!topic });
      res.status(400).json({
        success: false,
        error: 'Missing required webhook headers'
      });
      return;
    }

    // Store webhook metadata in request
    req.webhookTopic = topic;
    req.webhookShop = shop;
    req.webhookId = webhookId;

    // Verify HMAC
    const body = req.rawBody || req.body;
    if (!body) {
      console.warn('No body found for HMAC verification');
      res.status(400).json({
        success: false,
        error: 'No request body found'
      });
      return;
    }

    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    if (calculatedHmac !== hmac) {
      console.warn('HMAC verification failed:', {
        shop,
        topic,
        expected: calculatedHmac,
        received: hmac
      });
      res.status(401).json({
        success: false,
        error: 'HMAC verification failed'
      });
      return;
    }

    console.log('HMAC verification successful:', { shop, topic, webhookId });
    next();
  };
};

/**
 * Webhook event logging middleware
 */
export const logWebhookEvent = (req: WebhookRequest, _res: Response, next: NextFunction): void => {
  if (req.method === 'POST' && req.path.includes('/webhooks/')) {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    const webhookId = req.webhookId || 'unknown';
    
    console.log('Webhook event received:', {
      topic,
      shop,
      webhookId,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });
  }
  
  next();
};

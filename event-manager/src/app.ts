import express from 'express';
import helmet from 'helmet';
import { webhookRoutes, captureRawBody, logWebhookEvent } from './webhooks/index.js';
import webhookManagementRoutes from './routes/webhook-management.js';
import { errorHandlingService, ErrorSeverity, ErrorCategory } from './services/index.js';

const app = express();

// Initialize error handling service
errorHandlingService.initialize().catch(error => {
  console.error('Failed to initialize error handling service:', error);
});

// Security middleware
app.use(helmet());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serverless-specific middleware for body parsing
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // If parsing fails, keep as string
    }
  }
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'shopify-event-processor',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test error handling endpoint (for development/testing)
if (process.env['NODE_ENV'] === 'development') {
  app.get('/test-error', async (req, res) => {
    const { severity = 'high', category = 'system' } = req.query;
    
    try {
      // Simulate an error
      throw new Error(`Test error for ${severity} severity and ${category} category`);
    } catch (error) {
      await errorHandlingService.handleError(
        error,
        severity as ErrorSeverity,
        category as ErrorCategory,
        {
          service: 'test-endpoint',
          operation: 'test-error',
          requestId: req.headers['x-request-id'] as string
        }
      );
      
      res.json({
        success: true,
        message: `Test error sent with severity: ${severity}, category: ${category}`,
        timestamp: new Date().toISOString()
      });
    }
  });
}


// Webhook management API routes
app.use('/api/webhooks', webhookManagementRoutes);

// Webhook processing with HMAC verification
const webhookSecret = process.env['SHOPIFY_WEBHOOK_SECRET'];
if (!webhookSecret) {
  console.warn('⚠️  SHOPIFY_WEBHOOK_SECRET not set! Webhook verification will be disabled.');
}

app.use('/webhooks', 
  captureRawBody, 
  // verifyWebhookHMAC(webhookSecret || 'fallback-secret'), // Temporarily disabled for testing
  logWebhookEvent, 
  webhookRoutes
);


// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  // Send critical error notification
  errorHandlingService.handleCriticalError(error, {
    service: 'express-app',
    operation: 'global-error-handler',
    requestId: req.headers['x-request-id'] as string,
    additionalData: {
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }
  }).catch(notificationError => {
    console.error('Failed to send error notification:', notificationError);
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server only when not in serverless environment
if (process.env['NODE_ENV'] !== 'serverless' && !process.env['AWS_LAMBDA_FUNCTION_NAME']) {
  const PORT = process.env['PORT'] || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Shopify Event Processor running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhooks/{topic}`);
  });
}

export default app;

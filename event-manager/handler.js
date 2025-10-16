const serverless = require('serverless-http');
const app = require('./dist/app');

/**
 * AWS Lambda Handler
 * 
 * Uses serverless-http to convert API Gateway events to Express requests
 */

// Get the Express app (exported as default)
const expressApp = app.default;

// Wrap Express app with serverless-http
module.exports.handler = serverless(expressApp, {
  // Handle binary content types
  binary: ['image/*', 'application/pdf'],
  
  // Request and response configuration
  request: {
    key: 'event',
    context: 'context'
  }
});
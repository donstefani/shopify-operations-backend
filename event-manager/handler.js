const app = require('./dist/app');

/**
 * AWS Lambda Handler
 * 
 * This is the entry point for the serverless deployment.
 * It converts API Gateway events to Express requests and responses.
 */

const handler = async (
  event,
  context
) => {
  try {
    // Safety check for event
    if (!event) {
      console.error('No event provided to handler');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'No event provided'
        })
      };
    }

    // Get the Express app (it's exported as default)
    const expressApp = app.default;
    
    // Convert API Gateway event to Express-compatible format
    return new Promise((resolve) => {
      let responseBody = '';
      let statusCode = 200;
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Shopify-Hmac-Sha256,X-Shopify-Shop-Domain,X-Shopify-Topic,X-Shopify-Webhook-Id',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      };
      
      const mockReq = {
        method: event.httpMethod || 'GET',
        url: event.path || '/',
        headers: event.headers || {},
        body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : undefined,
        query: event.queryStringParameters || {},
        params: event.pathParameters || {},
        get: (name) => (event.headers && event.headers[name.toLowerCase()]) || (event.headers && event.headers[name]),
        header: (name) => (event.headers && event.headers[name.toLowerCase()]) || (event.headers && event.headers[name])
      };
      
      const mockRes = {
        statusCode: 200,
        status: (code) => {
          statusCode = code;
          return mockRes;
        },
        json: (data) => {
          responseBody = JSON.stringify(data);
          resolve({
            statusCode,
            headers,
            body: responseBody
          });
        },
        send: (data) => {
          responseBody = typeof data === 'string' ? data : JSON.stringify(data);
          resolve({
            statusCode,
            headers,
            body: responseBody
          });
        },
        end: (data) => {
          if (data) {
            responseBody = typeof data === 'string' ? data : JSON.stringify(data);
          }
          resolve({
            statusCode,
            headers,
            body: responseBody || JSON.stringify({ message: 'OK' })
          });
        },
        setHeader: (name, value) => {
          headers[name] = value;
        },
        removeHeader: (name) => {
          delete headers[name];
        },
        getHeader: (name) => {
          return headers[name];
        },
        hasHeader: (name) => {
          return name in headers;
        },
        writeHead: (code, reasonPhrase, headersObj) => {
          statusCode = code;
          if (typeof reasonPhrase === 'object') {
            headersObj = reasonPhrase;
          }
          if (headersObj) {
            Object.assign(headers, headersObj);
          }
        },
        write: (chunk) => {
          responseBody += chunk;
        }
      };
      
      // Handle the request with Express
      expressApp(mockReq, mockRes);
    });
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Export using CommonJS syntax for Lambda
exports.handler = handler;

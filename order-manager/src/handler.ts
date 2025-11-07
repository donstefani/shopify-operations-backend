import { ApolloServer } from '@apollo/server';
import {
  startServerAndCreateLambdaHandler,
  handlers,
} from '@as-integrations/aws-lambda';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  csrfPrevention: false, // Disable CSRF protection for development
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      extensions: {
        code: error.extensions?.code,
      },
    };
  },
});

// Create the Apollo Server handler
const apolloHandler = startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler()
);

// Custom handler that intercepts OPTIONS requests and adds CORS headers to all responses
export const handler = async (event: any, context: any) => {
  // Handle OPTIONS requests for CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apollo-Require-Preflight',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // For all other requests, use the Apollo Server handler and add CORS headers
  const response = await apolloHandler(event, context, () => {});
  
  // Add CORS headers to the response
  if (!response) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apollo-Require-Preflight',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
  
  return {
    ...response,
    headers: {
      ...(response.headers || {}),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apollo-Require-Preflight',
    },
  };
};


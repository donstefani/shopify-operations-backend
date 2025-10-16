import { OAuthService } from '../../src/auth/services/oauth.service';
import { TokenManagerService } from '../../src/auth/services/token.service';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create DynamoDB mock
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    dynamoMock.reset();
    jest.clearAllMocks();
    oauthService = new OAuthService();
  });

  describe('Constructor', () => {
    it('should initialize with required environment variables', () => {
      expect(oauthService).toBeDefined();
    });

    it('should throw error if SHOPIFY_CLIENT_ID is missing', () => {
      const originalClientId = process.env.SHOPIFY_CLIENT_ID;
      delete process.env.SHOPIFY_CLIENT_ID;

      expect(() => new OAuthService()).toThrow('SHOPIFY_CLIENT_ID environment variable is required');

      process.env.SHOPIFY_CLIENT_ID = originalClientId;
    });

    it('should throw error if SHOPIFY_CLIENT_SECRET is missing', () => {
      const originalClientSecret = process.env.SHOPIFY_CLIENT_SECRET;
      delete process.env.SHOPIFY_CLIENT_SECRET;

      expect(() => new OAuthService()).toThrow('SHOPIFY_CLIENT_SECRET environment variable is required');

      process.env.SHOPIFY_CLIENT_SECRET = originalClientSecret;
    });

    it('should throw error if SHOPIFY_REDIRECT_URI is missing', () => {
      const originalRedirectUri = process.env.SHOPIFY_REDIRECT_URI;
      delete process.env.SHOPIFY_REDIRECT_URI;

      expect(() => new OAuthService()).toThrow('SHOPIFY_REDIRECT_URI environment variable is required');

      process.env.SHOPIFY_REDIRECT_URI = originalRedirectUri;
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authorization URL', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      
      // Mock DynamoDB for state storage
      dynamoMock.resolves({});

      const result = await oauthService.generateAuthUrl(shopDomain);

      expect(result.success).toBe(true);
      expect(result.data?.authUrl).toBeDefined();
      expect(result.data?.state).toBeDefined();

      // Verify URL structure
      const authUrl = new URL(result.data!.authUrl);
      expect(authUrl.hostname).toBe(shopDomain);
      expect(authUrl.pathname).toBe('/admin/oauth/authorize');
      expect(authUrl.searchParams.get('client_id')).toBe('test-client-id');
      expect(authUrl.searchParams.get('scope')).toBe('read_products,write_products');
      expect(authUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
      expect(authUrl.searchParams.get('state')).toBe(result.data!.state);
    });

    it('should sanitize shop domain correctly', async () => {
      const testCases = [
        'test-shop.myshopify.com',
        'test-shop',
        'https://test-shop.myshopify.com',
        'http://test-shop.myshopify.com'
      ];

      dynamoMock.resolves({});

      for (const shopDomain of testCases) {
        const result = await oauthService.generateAuthUrl(shopDomain);
        expect(result.success).toBe(true);
        expect(result.data?.authUrl).toContain('test-shop.myshopify.com');
      }
    });

    it('should reject invalid shop domain formats', async () => {
      const invalidDomains = [
        '',
        ' ',
        'invalid domain with spaces',
        '-invalid-start',
        'invalid-end-',
        'invalid@domain'
      ];

      for (const shopDomain of invalidDomains) {
        const result = await oauthService.generateAuthUrl(shopDomain);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid shop domain format');
      }
    });

    it('should store OAuth state in DynamoDB', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      
      dynamoMock.resolves({});

      const result = await oauthService.generateAuthUrl(shopDomain);

      expect(result.success).toBe(true);
      
      // Verify state was stored
      const putCalls = dynamoMock.calls();
      expect(putCalls.length).toBeGreaterThan(0);
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      
      dynamoMock.rejects(new Error('DynamoDB connection error'));

      const result = await oauthService.generateAuthUrl(shopDomain);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DynamoDB connection error');
    });
  });

  describe('validateOAuthState', () => {
    it('should validate OAuth state successfully', async () => {
      const state = 'test-state-123';
      const shopDomain = 'test-shop.myshopify.com';

      // Create a real TokenManagerService instance for validation
      const tokenManager = new TokenManagerService();
      
      // Store state first
      dynamoMock.resolves({});
      await tokenManager.storeOAuthState(state, shopDomain);

      // Mock retrieval
      dynamoMock.resolves({
        Item: {
          id: `oauth_state:${state}`,
          shopDomain,
          createdAt: new Date().toISOString()
        }
      });

      const result = await oauthService.validateOAuthState(state);

      expect(result.valid).toBe(true);
      expect(result.shopDomain).toBe(shopDomain);
    });

    it('should return invalid for non-existent state', async () => {
      const state = 'invalid-state';

      dynamoMock.resolves({});

      const result = await oauthService.validateOAuthState(state);

      expect(result.valid).toBe(false);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange code for token', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const code = 'authorization-code-123';
      const state = 'test-state';

      const mockTokenResponse = {
        access_token: 'shpat_test_token_123',
        scope: 'read_products,write_products'
      };

      mockedAxios.post.mockResolvedValue({ data: mockTokenResponse });
      dynamoMock.resolves({});

      const result = await oauthService.exchangeCodeForToken(shopDomain, code, state);

      expect(result.success).toBe(true);
      expect(result.data?.access_token).toBe('shpat_test_token_123');
      expect(result.data?.scope).toBe('read_products,write_products');

      // Verify Shopify API was called correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-shop.myshopify.com/admin/oauth/access_token',
        {
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          code
        }
      );
    });

    it('should store token after successful exchange', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const code = 'authorization-code-123';
      const state = 'test-state';

      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'shpat_test_token',
          scope: 'read_products'
        }
      });
      dynamoMock.resolves({});

      await oauthService.exchangeCodeForToken(shopDomain, code, state);

      // Verify token was stored in DynamoDB
      const calls = dynamoMock.calls();
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should handle invalid shop domain', async () => {
      const invalidDomain = 'invalid domain';
      const code = 'test-code';
      const state = 'test-state';

      const result = await oauthService.exchangeCodeForToken(invalidDomain, code, state);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid shop domain format');
    });

    it('should handle Shopify API errors', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const code = 'invalid-code';
      const state = 'test-state';

      const apiError = {
        response: {
          data: { error: 'invalid_request' },
          status: 400,
          statusText: 'Bad Request'
        }
      };

      mockedAxios.post.mockRejectedValue(apiError);

      const result = await oauthService.exchangeCodeForToken(shopDomain, code, state);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to exchange code for token');
    });

    it('should handle network errors', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const code = 'test-code';
      const state = 'test-state';

      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const result = await oauthService.exchangeCodeForToken(shopDomain, code, state);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to exchange code for token');
    });
  });

  describe('getStoredToken', () => {
    it('should retrieve stored token successfully', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      // Create a token manager and store a token first
      const tokenManager = new TokenManagerService();
      
      let encryptedToken = '';
      
      // Mock PutCommand to capture encrypted token
      dynamoMock.on(PutCommand).callsFake((input: any) => {
        encryptedToken = input.Item?.encryptedToken || '';
        return {};
      });

      // Store the token
      await tokenManager.storeToken(shopDomain, 'shpat_test', 'read_products');

      // Mock GetCommand to return the stored encrypted token
      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken,
          scopes: 'read_products',
          createdAt: new Date().toISOString()
        }
      });

      const result = await oauthService.getStoredToken(shopDomain);

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('shpat_test');
      expect(result.data?.scopes).toBe('read_products');
    });

    it('should return error for non-existent token', async () => {
      const shopDomain = 'nonexistent-shop.myshopify.com';

      dynamoMock.resolves({});

      const result = await oauthService.getStoredToken(shopDomain);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No token found for this shop');
    });

    it('should handle invalid shop domain', async () => {
      const invalidDomain = '';

      const result = await oauthService.getStoredToken(invalidDomain);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid shop domain format');
    });
  });

  describe('revokeToken', () => {
    it('should successfully revoke token', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.resolves({});

      const result = await oauthService.revokeToken(shopDomain);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token revoked successfully');
    });

    it('should handle invalid shop domain', async () => {
      const invalidDomain = 'invalid@domain';

      const result = await oauthService.revokeToken(invalidDomain);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid shop domain format');
    });

    it('should handle deletion errors gracefully', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.rejects(new Error('DynamoDB error'));

      const result = await oauthService.revokeToken(shopDomain);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to revoke token');
    });
  });
});


import { TokenManagerService } from '../../src/auth/services/token.service';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Create DynamoDB mock
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('TokenManagerService', () => {
  let tokenService: TokenManagerService;

  beforeEach(() => {
    // Reset all mocks before each test
    dynamoMock.reset();
    tokenService = new TokenManagerService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateState', () => {
    it('should generate a secure random state string', () => {
      const state1 = tokenService.generateState();
      const state2 = tokenService.generateState();

      // Should be 64 characters (32 bytes in hex)
      expect(state1).toHaveLength(64);
      expect(state2).toHaveLength(64);
      
      // Should be different each time
      expect(state1).not.toBe(state2);
      
      // Should only contain hex characters
      expect(state1).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('storeOAuthState', () => {
    it('should store OAuth state in DynamoDB', async () => {
      const state = 'test-state-123';
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.on(PutCommand).resolves({});

      await tokenService.storeOAuthState(state, shopDomain);

      // Verify DynamoDB PutCommand was called with correct params
      const calls = dynamoMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);
      
      const putCall = calls[0];
      expect(putCall.args[0].input).toMatchObject({
        TableName: 'test-shopify-auth-tokens',
        Item: {
          id: `oauth_state:${state}`,
          shopDomain,
        }
      });
      expect(putCall.args[0].input.Item?.createdAt).toBeDefined();
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const state = 'test-state-123';
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      await expect(
        tokenService.storeOAuthState(state, shopDomain)
      ).rejects.toThrow('DynamoDB error');
    });
  });

  describe('validateOAuthState', () => {
    it('should validate and consume OAuth state successfully', async () => {
      const state = 'valid-state-123';
      const shopDomain = 'test-shop.myshopify.com';

      // Mock GetCommand to return valid state
      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `oauth_state:${state}`,
          shopDomain,
          createdAt: new Date().toISOString()
        }
      });

      // Mock DeleteCommand
      dynamoMock.on(DeleteCommand).resolves({});

      const result = await tokenService.validateOAuthState(state);

      expect(result.valid).toBe(true);
      expect(result.shopDomain).toBe(shopDomain);

      // Verify state was deleted (single-use)
      const deleteCalls = dynamoMock.commandCalls(DeleteCommand);
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0].args[0].input).toMatchObject({
        TableName: 'test-shopify-auth-tokens',
        Key: { id: `oauth_state:${state}` }
      });
    });

    it('should return invalid for non-existent state', async () => {
      const state = 'invalid-state-123';

      dynamoMock.on(GetCommand).resolves({});

      const result = await tokenService.validateOAuthState(state);

      expect(result.valid).toBe(false);
      expect(result.shopDomain).toBeUndefined();
    });

    it('should handle DynamoDB errors during validation', async () => {
      const state = 'test-state-123';

      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      const result = await tokenService.validateOAuthState(state);

      expect(result.valid).toBe(false);
      expect(result.shopDomain).toBeUndefined();
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt tokens correctly', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const accessToken = 'shpat_test123456789';
      const scopes = 'read_products,write_products';

      // Mock DynamoDB store and retrieve
      let storedEncryptedToken: string;

      dynamoMock.on(PutCommand).callsFake((input) => {
        storedEncryptedToken = input.Item.encryptedToken;
        return {};
      });

      dynamoMock.on(GetCommand).callsFake(() => ({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken: storedEncryptedToken,
          scopes,
          createdAt: new Date().toISOString()
        }
      }));

      // Store token (encrypts internally)
      await tokenService.storeToken(shopDomain, accessToken, scopes);

      // Retrieve token (decrypts internally)
      const result = await tokenService.getToken(shopDomain);

      expect(result).toBeDefined();
      expect(result?.accessToken).toBe(accessToken);
      expect(result?.scopes).toBe(scopes);
    });

    it('should produce different encrypted values for same input', async () => {
      const shopDomain1 = 'shop1.myshopify.com';
      const shopDomain2 = 'shop2.myshopify.com';
      const accessToken = 'shpat_same_token';
      const scopes = 'read_products';

      let encrypted1: string = '';
      let encrypted2: string = '';

      dynamoMock.on(PutCommand).callsFake((input) => {
        if (input.Item.id.includes('shop1')) {
          encrypted1 = input.Item.encryptedToken;
        } else {
          encrypted2 = input.Item.encryptedToken;
        }
        return {};
      });

      await tokenService.storeToken(shopDomain1, accessToken, scopes);
      await tokenService.storeToken(shopDomain2, accessToken, scopes);

      // Same token should produce different encrypted values (different IVs)
      expect(encrypted1).not.toBe(encrypted2);
      
      // Both should have proper format: iv:authTag:encrypted
      expect(encrypted1.split(':')).toHaveLength(3);
      expect(encrypted2.split(':')).toHaveLength(3);
    });
  });

  describe('storeToken', () => {
    it('should store encrypted token with TTL in DynamoDB', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      const accessToken = 'shpat_test123';
      const scopes = 'read_products,write_products';

      dynamoMock.on(PutCommand).resolves({});

      await tokenService.storeToken(shopDomain, accessToken, scopes);

      const calls = dynamoMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);
      
      const item = calls[0].args[0].input.Item!;
      expect(item.id).toBe(`token:${shopDomain}`);
      expect(item.encryptedToken).toBeDefined();
      expect(item.scopes).toBe(scopes);
      expect(item.createdAt).toBeDefined();
      expect(item.ttl).toBeDefined();
      
      // TTL should be approximately 30 days from now
      const expectedTTL = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      expect(item.ttl).toBeGreaterThanOrEqual(expectedTTL - 10);
      expect(item.ttl).toBeLessThanOrEqual(expectedTTL + 10);
    });
  });

  describe('getToken', () => {
    it('should retrieve and decrypt token from DynamoDB', async () => {
      const shopDomain = 'test-shop.myshopify.com';
      
      // First store a token to get encrypted version
      let encryptedToken: string = '';
      dynamoMock.on(PutCommand).callsFake((input) => {
        encryptedToken = input.Item.encryptedToken;
        return {};
      });

      await tokenService.storeToken(shopDomain, 'shpat_original_token', 'read_products');

      // Now mock the retrieval
      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken,
          scopes: 'read_products',
          createdAt: new Date().toISOString()
        }
      });

      const result = await tokenService.getToken(shopDomain);

      expect(result).toBeDefined();
      expect(result?.accessToken).toBe('shpat_original_token');
      expect(result?.scopes).toBe('read_products');
    });

    it('should return null for non-existent token', async () => {
      const shopDomain = 'nonexistent-shop.myshopify.com';

      dynamoMock.on(GetCommand).resolves({});

      const result = await tokenService.getToken(shopDomain);

      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      // Mock corrupted encrypted data
      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken: 'invalid:encrypted:data',
          scopes: 'read_products',
          createdAt: new Date().toISOString()
        }
      });

      const result = await tokenService.getToken(shopDomain);

      expect(result).toBeNull();
    });
  });

  describe('deleteToken', () => {
    it('should delete token from DynamoDB', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.on(DeleteCommand).resolves({});

      await tokenService.deleteToken(shopDomain);

      const calls = dynamoMock.commandCalls(DeleteCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        TableName: 'test-shopify-auth-tokens',
        Key: { id: `token:${shopDomain}` }
      });
    });

    it('should handle deletion errors', async () => {
      const shopDomain = 'test-shop.myshopify.com';

      dynamoMock.on(DeleteCommand).rejects(new Error('DynamoDB error'));

      await expect(
        tokenService.deleteToken(shopDomain)
      ).rejects.toThrow('DynamoDB error');
    });
  });
});
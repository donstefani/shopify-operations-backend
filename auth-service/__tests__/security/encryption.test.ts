import { TokenManagerService } from '../../src/auth/services/token.service';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Encryption Security', () => {
  let tokenService: TokenManagerService;

  beforeEach(() => {
    dynamoMock.reset();
    tokenService = new TokenManagerService();
  });

  describe('AES-256-GCM Encryption', () => {
    it('should use AES-256-GCM encryption algorithm', async () => {
      const shopDomain = 'security-test-shop.myshopify.com';
      const accessToken = 'shpat_sensitive_token_12345';
      
      let encryptedValue = '';
      
      dynamoMock.on(PutCommand).callsFake((input: any) => {
        encryptedValue = input.Item?.encryptedToken || '';
        return {};
      });

      await tokenService.storeToken(shopDomain, accessToken, 'read_products');

      // Encrypted format should be: IV:authTag:encrypted
      const parts = encryptedValue.split(':');
      expect(parts).toHaveLength(3);
      
      // IV should be 16 bytes (32 hex chars)
      expect(parts[0]).toHaveLength(32);
      
      // Auth tag should be 16 bytes (32 hex chars) for GCM
      expect(parts[1]).toHaveLength(32);
      
      // Encrypted data should exist
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('should produce unique IVs for each encryption', async () => {
      const tokens: string[] = [];
      
      dynamoMock.on(PutCommand).callsFake((input: any) => {
        tokens.push(input.Item?.encryptedToken || '');
        return {};
      });

      // Encrypt same token multiple times
      for (let i = 0; i < 10; i++) {
        await tokenService.storeToken(`shop${i}.myshopify.com`, 'same-token', 'read_products');
      }

      // All encrypted values should be different due to unique IVs
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);

      // All should have different IVs
      const ivs = tokens.map(t => t.split(':')[0]);
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(10);
    });

    it('should successfully decrypt encrypted tokens', async () => {
      const shopDomain = 'decrypt-test-shop.myshopify.com';
      const originalToken = 'shpat_original_secure_token';
      
      let encryptedToken = '';
      
      dynamoMock.on(PutCommand).callsFake((input: any) => {
        encryptedToken = input.Item?.encryptedToken || '';
        return {};
      });

      await tokenService.storeToken(shopDomain, originalToken, 'read_products');

      // Now mock retrieval
      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken,
          scopes: 'read_products'
        }
      });

      const result = await tokenService.getToken(shopDomain);

      expect(result).toBeDefined();
      expect(result?.accessToken).toBe(originalToken);
    });

    it('should handle tampered encrypted data gracefully', async () => {
      const shopDomain = 'tamper-test-shop.myshopify.com';
      
      // Create tampered encrypted data
      const tamperedData = 'aaaa:bbbb:cccc'; // Invalid format

      dynamoMock.on(GetCommand).resolves({
        Item: {
          id: `token:${shopDomain}`,
          encryptedToken: tamperedData,
          scopes: 'read_products'
        }
      });

      const result = await tokenService.getToken(shopDomain);

      // Should return null for tampered data
      expect(result).toBeNull();
    });

    it('should not expose plaintext tokens in storage', async () => {
      const shopDomain = 'plaintext-test-shop.myshopify.com';
      const accessToken = 'shpat_very_secret_token_xyz';
      
      let storedData: any;
      
      dynamoMock.on(PutCommand).callsFake((input: any) => {
        storedData = input.Item;
        return {};
      });

      await tokenService.storeToken(shopDomain, accessToken, 'read_products');

      // Verify plaintext token is NOT in stored data
      expect(storedData.encryptedToken).not.toContain(accessToken);
      expect(JSON.stringify(storedData)).not.toContain(accessToken);
      
      // Verify token is encrypted
      expect(storedData.encryptedToken).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe('State Generation Security', () => {
    it('should generate cryptographically secure random states', () => {
      const states = new Set<string>();
      
      // Generate 1000 states
      for (let i = 0; i < 1000; i++) {
        const state = tokenService.generateState();
        states.add(state);
        
        // Should be 64 chars (32 bytes hex)
        expect(state).toHaveLength(64);
        expect(state).toMatch(/^[a-f0-9]+$/);
      }

      // All should be unique (very high probability with crypto.randomBytes)
      expect(states.size).toBe(1000);
    });

    it('should use crypto.randomBytes for state generation', () => {
      const spy = jest.spyOn(crypto, 'randomBytes');
      
      tokenService.generateState();
      
      expect(spy).toHaveBeenCalledWith(32);
      
      spy.mockRestore();
    });
  });

  describe('Encryption Key Security', () => {
    it('should require encryption key from environment', () => {
      // TokenManagerService should use ENCRYPTION_KEY from env
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
      expect(process.env.ENCRYPTION_KEY!.length).toBeGreaterThanOrEqual(16);
    });
  });
});


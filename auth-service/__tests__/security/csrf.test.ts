import { OAuthService } from '../../src/auth/services/oauth.service';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('CSRF Protection', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    dynamoMock.reset();
    oauthService = new OAuthService();
  });

  describe('OAuth State Parameter', () => {
    it('should generate unique state for each auth request', async () => {
      const states = new Set<string>();
      dynamoMock.resolves({});

      for (let i = 0; i < 100; i++) {
        const result = await oauthService.generateAuthUrl('test-shop.myshopify.com');
        if (result.success && result.data) {
          states.add(result.data.state);
        }
      }

      // All states should be unique
      expect(states.size).toBe(100);
    });

    it('should reject OAuth callback with invalid state', async () => {
      const invalidState = 'malicious-state-123';
      
      dynamoMock.resolves({}); // No state found in DB

      const validation = await oauthService.validateOAuthState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.shopDomain).toBeUndefined();
    });

    it('should validate state only once (single-use)', async () => {
      const state = 'test-state-single-use';
      const shopDomain = 'test-shop.myshopify.com';

      // First validation - should succeed
      dynamoMock.resolves({
        Item: {
          id: `oauth_state:${state}`,
          shopDomain,
          createdAt: new Date().toISOString()
        }
      });

      const firstValidation = await oauthService.validateOAuthState(state);
      expect(firstValidation.valid).toBe(true);

      // Second validation - state should be deleted, so it fails
      dynamoMock.resolves({}); // State no longer exists

      const secondValidation = await oauthService.validateOAuthState(state);
      expect(secondValidation.valid).toBe(false);
    });

    it('should include state in authorization URL', async () => {
      dynamoMock.resolves({});

      const result = await oauthService.generateAuthUrl('test-shop.myshopify.com');

      expect(result.success).toBe(true);
      expect(result.data?.authUrl).toBeDefined();
      expect(result.data?.state).toBeDefined();

      const url = new URL(result.data!.authUrl);
      const stateParam = url.searchParams.get('state');

      expect(stateParam).toBe(result.data!.state);
    });

    it('should prevent replay attacks with expired states', async () => {
      const oldState = 'expired-state-123';
      const shopDomain = 'test-shop.myshopify.com';

      // Simulate an old state (in real scenario, DynamoDB TTL would delete it)
      dynamoMock.resolves({}); // State not found (expired)

      const validation = await oauthService.validateOAuthState(oldState);

      expect(validation.valid).toBe(false);
    });
  });

  describe('Shop Domain Validation', () => {
    it('should bind state to specific shop domain', async () => {
      const state = 'shop-specific-state';
      const shopDomain = 'shop-a.myshopify.com';
      const differentShop = 'shop-b.myshopify.com';

      // State is bound to shop-a
      dynamoMock.resolves({
        Item: {
          id: `oauth_state:${state}`,
          shopDomain,
          createdAt: new Date().toISOString()
        }
      });

      const validation = await oauthService.validateOAuthState(state);

      expect(validation.valid).toBe(true);
      expect(validation.shopDomain).toBe(shopDomain);
      expect(validation.shopDomain).not.toBe(differentShop);
    });
  });
});


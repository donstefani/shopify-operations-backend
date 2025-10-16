import axios from 'axios';
import { OAuthConfig, ShopifyTokenResponse, OAuthApiResponse } from '../types/auth.types.js';
import { TokenManagerService } from './token.service.js';

/**
 * Simplified OAuth Service
 * 
 * Clean OAuth 2.0 implementation for Shopify authentication
 */

export class OAuthService {
  private readonly tokenManager: TokenManagerService;
  private readonly config: OAuthConfig;

  constructor() {
    this.tokenManager = new TokenManagerService();
    
    // Validate required environment variables
    if (!process.env.SHOPIFY_CLIENT_ID) {
      throw new Error('SHOPIFY_CLIENT_ID environment variable is required');
    }
    if (!process.env.SHOPIFY_CLIENT_SECRET) {
      throw new Error('SHOPIFY_CLIENT_SECRET environment variable is required');
    }
    if (!process.env.SHOPIFY_REDIRECT_URI) {
      throw new Error('SHOPIFY_REDIRECT_URI environment variable is required');
    }

    // Initialize OAuth configuration
    this.config = {
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
      redirectUri: process.env.SHOPIFY_REDIRECT_URI,
      scopes: (process.env.SHOPIFY_SCOPES || 'read_products,write_products').split(',').map(s => s.trim()),
      apiVersion: process.env.SHOPIFY_API_VERSION || '2025-07'
    };
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  async generateAuthUrl(shopDomain: string): Promise<OAuthApiResponse<{ authUrl: string; state: string }>> {
    try {
      const cleanShopDomain = this.sanitizeShopDomain(shopDomain);
      
      if (!cleanShopDomain) {
        return {
          success: false,
          error: 'Invalid shop domain format'
        };
      }

      const state = this.tokenManager.generateState();
      
      // Store state in DynamoDB for validation
      await this.tokenManager.storeOAuthState(state, cleanShopDomain);
      
      const authUrl = new URL(`https://${cleanShopDomain}/admin/oauth/authorize`);
      authUrl.searchParams.set('client_id', this.config.clientId);
      authUrl.searchParams.set('scope', this.config.scopes.join(','));
      authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
      authUrl.searchParams.set('state', state);

      return {
        success: true,
        data: {
          authUrl: authUrl.toString(),
          state
        }
      };
    } catch (error) {
      console.error('Error generating auth URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate authorization URL'
      };
    }
  }

  /**
   * Validate OAuth state parameter
   */
  async validateOAuthState(state: string): Promise<{ valid: boolean; shopDomain?: string }> {
    return await this.tokenManager.validateOAuthState(state);
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    shopDomain: string, 
    code: string, 
    state: string
  ): Promise<OAuthApiResponse<ShopifyTokenResponse>> {
    try {
      const cleanShopDomain = this.sanitizeShopDomain(shopDomain);
      
      if (!cleanShopDomain) {
        return {
          success: false,
          error: 'Invalid shop domain format'
        };
      }

      const tokenUrl = `https://${cleanShopDomain}/admin/oauth/access_token`;
      
      const response = await axios.post(tokenUrl, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code
      });

      const tokenData: ShopifyTokenResponse = response.data;
      
      // Store token securely
      await this.tokenManager.storeToken(cleanShopDomain, tokenData.access_token, tokenData.scope);

      return {
        success: true,
        data: tokenData,
        message: 'Token exchange successful'
      };
    } catch (error: any) {
      console.error('Token exchange error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      return {
        success: false,
        error: 'Failed to exchange code for token',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get stored token for a shop
   */
  async getStoredToken(shopDomain: string): Promise<OAuthApiResponse<{ accessToken: string; scopes: string }>> {
    try {
      const cleanShopDomain = this.sanitizeShopDomain(shopDomain);
      
      if (!cleanShopDomain) {
        return {
          success: false,
          error: 'Invalid shop domain format'
        };
      }

      const tokenData = await this.tokenManager.getToken(cleanShopDomain);
      
      if (!tokenData) {
        return {
          success: false,
          error: 'No token found for this shop'
        };
      }

      return {
        success: true,
        data: tokenData
      };
    } catch (error) {
      console.error('Error retrieving token:', error);
      return {
        success: false,
        error: 'Failed to retrieve token'
      };
    }
  }

  /**
   * Revoke token and clean up
   */
  async revokeToken(shopDomain: string): Promise<OAuthApiResponse<never>> {
    try {
      const cleanShopDomain = this.sanitizeShopDomain(shopDomain);
      
      if (!cleanShopDomain) {
        return {
          success: false,
          error: 'Invalid shop domain format'
        };
      }

      await this.tokenManager.deleteToken(cleanShopDomain);

      return {
        success: true,
        message: 'Token revoked successfully'
      };
    } catch (error) {
      console.error('Error revoking token:', error);
      return {
        success: false,
        error: 'Failed to revoke token'
      };
    }
  }

  /**
   * Sanitize and validate shop domain
   */
  private sanitizeShopDomain(shopDomain: string): string | null {
    if (!shopDomain || typeof shopDomain !== 'string') {
      return null;
    }

    let cleanDomain = shopDomain.replace(/^https?:\/\//, '');
    
    cleanDomain = cleanDomain.replace(/\.myshopify\.com$/, '');
    
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$/.test(cleanDomain)) {
      return null;
    }

    return `${cleanDomain}.myshopify.com`;
  }
}

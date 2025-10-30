import { Router, Request, Response } from 'express';
import { OAuthService } from '../services/oauth.service';
import { OAuthRequestSchema, OAuthCallbackSchema } from '../types/auth.types';

/**
 * Simplified Auth Routes
 * 
 * Clean OAuth endpoints for Shopify authentication
 */

const router = Router();

// Lazy initialization
let oauthService: OAuthService | null = null;

const getOAuthService = () => {
  if (!oauthService) {
    oauthService = new OAuthService();
  }
  return oauthService;
};

/**
 * GET /auth/shopify
 * 
 * Generate authorization URL for OAuth flow
 */
router.get('/shopify', async (req: Request, res: Response) => {
  try {
    const validation = OAuthRequestSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.issues.map(e => e.message).join(', ')
      });
    }

    const { shop } = validation.data;
    const result = await getOAuthService().generateAuthUrl(shop);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: {
        authUrl: result.data!.authUrl,
        message: 'Redirect user to the authorization URL to complete OAuth flow'
      }
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL'
    });
  }
});

/**
 * GET /auth/shopify/callback
 * 
 * Handle OAuth callback from Shopify
 */
router.get('/shopify/callback', async (req: Request, res: Response) => {
  try {
    const validation = OAuthCallbackSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.issues.map(e => e.message).join(', ')
      });
    }

    const { code, state, shop } = validation.data;

    // Validate state parameter using DynamoDB
    const stateValidation = await getOAuthService().validateOAuthState(state);
    if (!stateValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter. Possible CSRF attack.'
      });
    }

    // Validate shop domain matches stored state
    if (stateValidation.shopDomain !== shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop domain mismatch. Possible security issue.'
      });
    }

    // Exchange code for tokens
    const result = await getOAuthService().exchangeCodeForToken(shop, code, state);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Clear OAuth state and update session
    delete req.session.oauthState;
    req.session.shopDomain = shop;
    req.session.isAuthenticated = true;

    res.json({
      success: true,
      data: {
        shop,
        scopes: result.data!.scope,
        message: 'OAuth flow completed successfully'
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process OAuth callback'
    });
  }
});

/**
 * GET /auth/status
 * 
 * Check authentication status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Check if we have session data
    if (req.session.isAuthenticated && req.session.shopDomain) {
      // Get stored token to verify it still exists
      const tokenResult = await getOAuthService().getStoredToken(req.session.shopDomain);
      
      if (tokenResult.success) {
        return res.json({
          success: true,
          data: {
            authenticated: true,
            shop: req.session.shopDomain,
            hasToken: true,
            scopes: tokenResult.data!.scopes
          }
        });
      } else {
        // Token doesn't exist, clear session
        req.session.destroy(() => {});
        return res.json({
          success: true,
          data: {
            authenticated: false,
            message: 'Token not found'
          }
        });
      }
    }

    // No session data
    res.json({
      success: true,
      data: {
        authenticated: false,
        message: 'Not authenticated'
      }
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status'
    });
  }
});

/**
 * GET /auth/token
 * 
 * Get access token for authenticated shop
 */
router.get('/token', async (req: Request, res: Response) => {
  try {
    if (!req.session.isAuthenticated || !req.session.shopDomain) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const result = await getOAuthService().getStoredToken(req.session.shopDomain);
    
    if (!result.success) {
      // Token doesn't exist, clear session
      req.session.destroy(() => {});
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: {
        accessToken: result.data!.accessToken,
        scopes: result.data!.scopes,
        shop: req.session.shopDomain
      }
    });
  } catch (error) {
    console.error('Get token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve token'
    });
  }
});

/**
 * GET /auth/token/:shop
 * 
 * Get access token for a specific shop (for testing)
 */
router.get('/token/:shop', async (req: Request, res: Response) => {
  try {
    const { shop } = req.params;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    const result = await getOAuthService().getStoredToken(shop);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Token not found for this shop'
      });
    }

    res.json({
      success: true,
      data: {
        accessToken: result.data!.accessToken,
        scopes: result.data!.scopes,
        shop: shop
      }
    });
  } catch (error) {
    console.error('Get token by shop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve token'
    });
  }
});

/**
 * POST /auth/logout
 * 
 * Logout and revoke access
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    if (req.session.shopDomain) {
      // Revoke token
      await getOAuthService().revokeToken(req.session.shopDomain);
    }

    // Clear session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout'
    });
  }
});

export { router as authRoutes };

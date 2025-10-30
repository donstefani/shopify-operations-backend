import session from 'express-session';
import { AuthSession } from '../types/auth.types.js';

/**
 * Simplified Session Middleware
 * 
 * Clean session configuration for OAuth state management
 */

// Extend Express Session interface
declare module 'express-session' {
  interface SessionData extends AuthSession {}
}

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 60 * 1000, // 30 minutes
    sameSite: 'lax' as const
  },
  name: 'shopify-auth-session'
});

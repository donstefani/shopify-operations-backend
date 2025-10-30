import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes, sessionMiddleware } from './auth/index';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true, // Allow all origins in dev
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for OAuth
app.use(sessionMiddleware);

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'shopify-auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export default app;

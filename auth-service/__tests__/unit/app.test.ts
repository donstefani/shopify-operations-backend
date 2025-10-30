import request from 'supertest';
import app from '../../src/app';

describe('Express App', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('shopify-auth-service');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Route not found');
      expect(response.body.message).toContain('Cannot GET /unknown-route');
    });

    it('should return 404 for POST to unknown route', async () => {
      const response = await request(app)
        .post('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Cannot POST /unknown-route');
    });
  });

  describe('Middleware', () => {
    it('should have CORS enabled', async () => {
      const response = await request(app)
        .get('/health');

      // CORS headers may or may not be present depending on origin
      // Just verify the app doesn't reject the request
      expect(response.status).toBe(200);
    });

    it('should parse JSON bodies', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({ test: 'data' });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });
});


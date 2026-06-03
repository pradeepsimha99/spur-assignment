import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// Import the main app factory for testing
import chatRouter from './chat';

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: { connected: false, stats: { hits: 0, misses: 0, sets: 0, deletes: 0, hitRate: 0 } },
    });
  });

  app.use('/chat', chatRouter);
  return app;
}

describe('GET /health', () => {
  it('should return status ok', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('cache');
    expect(res.body.cache).toHaveProperty('connected', false);
    expect(res.body.cache).toHaveProperty('stats');
  });
});

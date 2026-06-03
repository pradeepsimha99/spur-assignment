import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import { errorHandler } from './middleware/validation';
import { connectRedis, closeRedis, getCacheHealth } from './cache/redis';
import { chatRateLimit, healthRateLimit } from './middleware/rateLimit';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust proxy for correct IP detection behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', healthRateLimit, async (_req, res) => {
  const cacheHealth = await getCacheHealth();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: cacheHealth,
  });
});

// Routes
app.use('/chat', chatRateLimit, chatRouter);

// Error handler (must be after routes)
app.use(errorHandler);

// Start server
async function start() {
  // Connect to Redis (non-blocking - app works without it)
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`[Server] AI Chat Agent backend running on http://localhost:${PORT}`);
    console.log(`[Server] LLM Model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await closeRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await closeRedis();
  process.exit(0);
});

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

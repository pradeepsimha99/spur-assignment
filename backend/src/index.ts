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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  'https://spur-assignment-sable.vercel.app',
];
if (process.env.FRONTEND_URL) {
  // Add the configured FRONTEND_URL (with and without trailing slash)
  const url = process.env.FRONTEND_URL.replace(/\/+$/, '');
  if (!allowedOrigins.includes(url)) {
    allowedOrigins.push(url);
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Strip trailing slash from origin before comparing
    const normalized = origin.replace(/\/+$/, '');
    if (allowedOrigins.some(o => normalized === o)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
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

// ===== Keep-Alive: prevents Render free tier from spinning down =====
// Pings self every 10 minutes to keep the service awake
const KEEPALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const KEEPALIVE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function startKeepAlive() {
  console.log(`[KeepAlive] Starting self-ping every 10 minutes to ${KEEPALIVE_URL}/health`);
  setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${KEEPALIVE_URL}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as { status?: string; timestamp?: string };
        console.log(`[KeepAlive] Ping successful — status: ${data.status}, time: ${data.timestamp}`);
      }
    } catch (err) {
      // Silently fail — keep-alive is best-effort
      console.warn(`[KeepAlive] Ping failed (expected during first few seconds): ${err instanceof Error ? err.message : err}`);
    }
  }, KEEPALIVE_INTERVAL);
}

// Start server
async function start() {
  // Connect to Redis (non-blocking - app works without it)
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`[Server] AI Chat Agent backend running on http://localhost:${PORT}`);
    console.log(`[Server] LLM Model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
  });

  // Start keep-alive after a delay to let the server fully boot
  setTimeout(startKeepAlive, 5000);
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

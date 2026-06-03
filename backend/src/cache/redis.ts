import Redis from 'ioredis';

let redisClient: Redis | null = null;

// Cache statistics for monitoring
export const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  },
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
  },
};

// Default TTLs in seconds
const DEFAULT_TTLS: Record<string, number> = {
  conversation: 300,       // 5 minutes
  history: 60,             // 1 minute
  faq: 3600,               // 1 hour
};

export function getCacheTTL(type: string): number {
  const envVar = `CACHE_TTL_${type.toUpperCase()}`;
  const envValue = process.env[envVar];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TTLS[type] || 300;
}

// --- Cache key helpers ---

export function conversationKey(sessionId: string): string {
  return `conversation:${sessionId}`;
}

export function historyKey(conversationId: string): string {
  return `history:${conversationId}`;
}

export function faqKey(question: string): string {
  return `faq:${question.toLowerCase().trim().slice(0, 100)}`;
}

// --- Redis client management ---

export function getRedisClient(): Redis | null {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  return null;
}

export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

export async function connectRedis(): Promise<Redis | null> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Skip Redis if URL is empty or explicitly disabled
  if (!redisUrl || process.env.REDIS_ENABLED === 'false') {
    console.log('[Cache] Redis is disabled. Skipping connection.');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Cache] Redis connection failed after 3 retries. Continuing without cache.');
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Suppress unhandled error events (e.g. ECONNREFUSED when Redis isn't running)
    redisClient.on('error', (err) => {
      if (process.env.DEBUG_REDIS) {
        console.warn('[Cache] Redis client error:', (err as Error).message);
      }
    });

    redisClient.on('ready', () => {
      console.log('[Cache] Redis connection ready.');
    });

    redisClient.on('connect', () => {
      console.log(`[Cache] Redis client connected (host: ${redisUrl}).`);
    });

    redisClient.on('close', () => {
      if (process.env.DEBUG_REDIS) {
        console.log('[Cache] Redis connection closed.');
      }
    });

    await redisClient.connect();
    console.log('[Cache] Redis connected successfully.');
    console.log(`[Cache] Connection target: ${redisUrl} — verify this matches your Docker container.`);
    console.log(`[Cache] If you cannot see the Redis container in Docker Desktop, ensure you ran: docker compose up -d`);
    console.log(`[Cache] A local/native Redis installation will also connect but won't appear in Docker Desktop.`);
    return redisClient;
  } catch (error) {
    console.warn('[Cache] Redis connection failed. Continuing without cache:', (error as Error).message);
    redisClient = null;
    return null;
  }
}

// --- Cache operations ---

export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (value !== null) {
      cacheStats.hits++;
    } else {
      cacheStats.misses++;
    }
    return value;
  } catch {
    cacheStats.misses++;
    return null;
  }
}

export async function cacheGetObject<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const ttl = ttlSeconds ?? getCacheTTL('default');
    await client.set(key, value, 'EX', ttl);
    cacheStats.sets++;
  } catch {
    // Silently fail - cache is optional
  }
}

export async function cacheSetObject<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
    cacheStats.deletes++;
  } catch {
    // Silently fail
  }
}

/**
 * Delete all cache keys matching a pattern.
 * Uses Redis SCAN to avoid blocking on large key spaces.
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    let cursor = '0';
    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await client.del(...keys);
        cacheStats.deletes += keys.length;
      }
    } while (cursor !== '0');
  } catch {
    // Silently fail
  }
}

/**
 * Invalidate all caches related to a conversation.
 */
export async function invalidateConversationCache(conversationId: string): Promise<void> {
  await Promise.all([
    cacheDelete(conversationKey(conversationId)),
    cacheDelete(historyKey(conversationId)),
    cacheDeletePattern(`faq:*`),
  ]);
}

/**
 * Get cache health status for the /health endpoint.
 */
export async function getCacheHealth(): Promise<{
  connected: boolean;
  stats: { hits: number; misses: number; sets: number; deletes: number; hitRate: number };
  info?: string;
}> {
  const connected = isRedisConnected();
  const stats = {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    sets: cacheStats.sets,
    deletes: cacheStats.deletes,
    hitRate: cacheStats.hitRate,
  };

  let info: string | undefined;
  if (connected && redisClient) {
    try {
      const redisInfo = await redisClient.info('server');
      const versionMatch = redisInfo.match(/redis_version:([^\r\n]+)/);
      info = versionMatch ? `Redis v${versionMatch[1].trim()}` : 'connected';
    } catch {
      info = 'connected';
    }
  }

  return { connected, stats, info };
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // ignore
    }
    redisClient = null;
  }
}

import { getRedisClient } from '../cache/redis';

/**
 * In-memory fallback store for idempotency keys when Redis is unavailable.
 * Keys expire after IDEMPOTENCY_TTL seconds (default 3600 = 1 hour).
 */
const memoryStore = new Map<string, { reply: string; sessionId: string; expiresAt: number }>();

const IDEMPOTENCY_TTL = Number(process.env.IDEMPOTENCY_TTL) || 3600; // 1 hour default

/**
 * Check if an idempotency key has already been processed.
 * If yes, returns the cached response. If no, returns null.
 */
export async function getIdempotencyResult(key: string): Promise<{ reply: string; sessionId: string } | null> {
  const client = getRedisClient();

  if (client) {
    try {
      const cached = await client.get(`idempotency:${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch {
      // Fall through to memory store
    }
  }

  // Fallback: in-memory store
  const entry = memoryStore.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return { reply: entry.reply, sessionId: entry.sessionId };
  }
  if (entry) {
    memoryStore.delete(key);
  }
  return null;
}

/**
 * Store the result of an idempotent operation.
 */
export async function setIdempotencyResult(
  key: string,
  result: { reply: string; sessionId: string }
): Promise<void> {
  const client = getRedisClient();

  if (client) {
    try {
      await client.set(`idempotency:${key}`, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL);
      return;
    } catch {
      // Fall through to memory store
    }
  }

  // Fallback: in-memory store
  memoryStore.set(key, {
    ...result,
    expiresAt: Date.now() + IDEMPOTENCY_TTL * 1000,
  });

  // Cleanup: keep memory store under 1000 entries
  if (memoryStore.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryStore) {
      if (v.expiresAt <= now) {
        memoryStore.delete(k);
      }
    }
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cacheStats,
  getCacheTTL,
  conversationKey,
  historyKey,
  faqKey,
  isRedisConnected,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  invalidateConversationCache,
  getCacheHealth,
} from './redis';

// Mock ioredis before importing the module
const mockRedisInstance = {
  on: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  scan: vi.fn(),
  info: vi.fn(),
  status: 'ready' as const,
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedisInstance),
    Redis: vi.fn(() => mockRedisInstance),
  };
});

describe('Redis Cache Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStats.reset();
  });

  describe('cacheStats', () => {
    it('should start with zero values', () => {
      expect(cacheStats.hits).toBe(0);
      expect(cacheStats.misses).toBe(0);
      expect(cacheStats.sets).toBe(0);
      expect(cacheStats.deletes).toBe(0);
      expect(cacheStats.hitRate).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      cacheStats.hits = 3;
      cacheStats.misses = 1;
      expect(cacheStats.hitRate).toBe(0.75);
    });

    it('should reset all stats', () => {
      cacheStats.hits = 10;
      cacheStats.misses = 5;
      cacheStats.sets = 8;
      cacheStats.deletes = 3;
      cacheStats.reset();
      expect(cacheStats.hits).toBe(0);
      expect(cacheStats.misses).toBe(0);
      expect(cacheStats.sets).toBe(0);
      expect(cacheStats.deletes).toBe(0);
    });
  });

  describe('getCacheTTL', () => {
    it('should return default TTL for unknown type', () => {
      expect(getCacheTTL('unknown')).toBe(300);
    });

    it('should return specific TTL for known types', () => {
      expect(getCacheTTL('conversation')).toBe(300);
      expect(getCacheTTL('history')).toBe(60);
      expect(getCacheTTL('faq')).toBe(3600);
    });

    it('should use env var when set', () => {
      process.env.CACHE_TTL_CONVERSATION = '600';
      expect(getCacheTTL('conversation')).toBe(600);
      delete process.env.CACHE_TTL_CONVERSATION;
    });
  });

  describe('cacheKey helpers', () => {
    it('should generate correct conversation key', () => {
      expect(conversationKey('abc-123')).toBe('conversation:abc-123');
    });

    it('should generate correct history key', () => {
      expect(historyKey('conv-1')).toBe('history:conv-1');
    });

    it('should generate correct FAQ key with normalization', () => {
      const key = faqKey('  What Is Your Return Policy?  ');
      expect(key).toBe('faq:what is your return policy?');
      expect(key.length).toBeLessThanOrEqual(100 + 4); // 'faq:' prefix + 100 chars
    });
  });

  describe('isRedisConnected', () => {
    it('should return false initially (no client)', () => {
      expect(isRedisConnected()).toBe(false);
    });
  });

  describe('getRedisClient', () => {
    it('should return null when not connected', () => {
      expect(getRedisClient()).toBeNull();
    });
  });

  describe('cacheGet', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await cacheGet('test-key');
      expect(result).toBeNull();
    });
  });

  describe('cacheSet', () => {
    it('should silently fail when Redis is not connected', async () => {
      await expect(cacheSet('test-key', 'value')).resolves.not.toThrow();
    });
  });

  describe('cacheDelete', () => {
    it('should silently fail when Redis is not connected', async () => {
      await expect(cacheDelete('test-key')).resolves.not.toThrow();
    });
  });

  describe('cacheDeletePattern', () => {
    it('should silently fail when Redis is not connected', async () => {
      await expect(cacheDeletePattern('faq:*')).resolves.not.toThrow();
    });
  });

  describe('invalidateConversationCache', () => {
    it('should silently fail when Redis is not connected', async () => {
      await expect(invalidateConversationCache('conv-1')).resolves.not.toThrow();
    });
  });

  describe('getCacheHealth', () => {
    it('should return not connected when Redis is not available', async () => {
      const health = await getCacheHealth();
      expect(health.connected).toBe(false);
      expect(health.stats).toBeDefined();
      expect(typeof health.stats.hitRate).toBe('number');
    });
  });
});

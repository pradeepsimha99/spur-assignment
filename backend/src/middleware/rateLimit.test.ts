import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock Redis client
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

// Mock the getRedisClient to return our mock
vi.mock('../cache/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cache/redis')>();
  return {
    ...actual,
    getRedisClient: vi.fn(() => mockRedisInstance),
  };
});

describe('Rate Limit Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let setHeader: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    json = vi.fn();
    status = vi.fn(() => ({ json }));
    setHeader = vi.fn();
    next = vi.fn();

    req = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    res = {
      status: status as any,
      setHeader: setHeader as any,
    };
  });

  it('should allow requests under the limit', async () => {
    mockRedisInstance.incr.mockResolvedValue(1);
    mockRedisInstance.expire.mockResolvedValue(1);

    const { rateLimit } = await import('./rateLimit');
    const middleware = rateLimit('test');

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith(429);
  });

  it('should block requests over the limit', async () => {
    mockRedisInstance.incr.mockResolvedValue(21); // max is 20
    mockRedisInstance.ttl.mockResolvedValue(45);

    const { rateLimit } = await import('./rateLimit');
    const middleware = rateLimit('test');

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Too many requests',
        retryAfter: 45,
      })
    );
  });

  it('should set rate limit headers', async () => {
    mockRedisInstance.incr.mockResolvedValue(5);
    mockRedisInstance.expire.mockResolvedValue(1);

    const { rateLimit } = await import('./rateLimit');
    const middleware = rateLimit('test');

    await middleware(req as Request, res as Response, next);

    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 20);
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 15);
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should allow request if Redis errors', async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error('Redis down'));

    const { rateLimit } = await import('./rateLimit');
    const middleware = rateLimit('test');

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith(429);
  });
});

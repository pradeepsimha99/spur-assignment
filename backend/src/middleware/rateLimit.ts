import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../cache/redis';

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Rate limit key prefix */
  prefix: string;
}

/**
 * Get rate limit configuration from environment variables.
 */
function getRateLimitConfig(prefix: string): RateLimitConfig {
  const maxRequestsEnv = process.env[`RATE_LIMIT_${prefix}_MAX`];
  const windowSecondsEnv = process.env[`RATE_LIMIT_${prefix}_WINDOW`];

  return {
    maxRequests: maxRequestsEnv ? parseInt(maxRequestsEnv, 10) : 20,
    windowSeconds: windowSecondsEnv ? parseInt(windowSecondsEnv, 10) : 60,
    prefix: `ratelimit:${prefix.toLowerCase()}`,
  };
}

/**
 * Rate limiting middleware backed by Redis.
 * Falls back to allowing the request if Redis is unavailable.
 */
export function rateLimit(prefix: string = 'default') {
  const config = getRateLimitConfig(prefix);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = getRedisClient();

    // If Redis is not available, allow the request (graceful degradation)
    if (!client) {
      next();
      return;
    }

    // Use IP or a combination of IP + endpoint as the identifier
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${config.prefix}:${identifier}`;

    try {
      const result = await client.incr(key);

      // Set expiry on first request
      if (result === 1) {
        await client.expire(key, config.windowSeconds);
      }

      if (result > config.maxRequests) {
        const remainingTtl = await client.ttl(key);

        res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${remainingTtl} seconds.`,
          retryAfter: remainingTtl,
        });
        return;
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - result));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + config.windowSeconds);

      next();
    } catch (error) {
      // If Redis fails, allow the request (graceful degradation)
      console.warn('[RateLimit] Redis error, allowing request:', (error as Error).message);
      next();
    }
  };
}

/**
 * Pre-configured rate limiters for different endpoints.
 */
export const chatRateLimit = rateLimit('chat');
export const healthRateLimit = rateLimit('health');

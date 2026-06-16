import type { Context, Next } from 'hono';

const RATE_LIMIT_PREFIX = 'rl:';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    if (c.env.DISABLE_RATE_LIMIT) {
      return next();
    }

    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const key = `${RATE_LIMIT_PREFIX}${ip}`;
    const kv = c.env.SESSIONS;

    const current = await kv.get(key, 'text');
    const count = current ? parseInt(current, 10) : 0;

    if (count >= options.maxRequests) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        },
        429 as const
      );
    }

    await kv.put(key, String(count + 1), {
      expirationTtl: Math.ceil(options.windowMs / 1000),
    });

    return next();
  };
}
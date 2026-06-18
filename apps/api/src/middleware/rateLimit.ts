import type { MiddlewareHandler } from "hono";
import { AppError } from "./error";

export interface RateLimitOptions {
  /** window seconds */
  window: number;
  /** max requests per window per key */
  max: number;
  /** key prefix; combined with ip + bucket */
  scope: string;
  /** if true, read DISABLE_RATE_LIMIT env and skip */
  respectDevFlag?: boolean;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    if (opts.respectDevFlag && c.env.DISABLE_RATE_LIMIT === "1") {
      await next();
      return;
    }

    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / opts.window);
    const key = `rl:${opts.scope}:${ip}:${bucket}`;

    const currentRaw = await c.env.SESSIONS.get(key);
    const current = currentRaw ? parseInt(currentRaw, 10) : 0;
    if (current >= opts.max) {
      const resetIn = (bucket + 1) * opts.window - now;
      c.header("Retry-After", String(resetIn));
      throw new AppError(
        "RATE_LIMITED",
        `Too many requests. Retry in ${resetIn}s.`,
        429,
      );
    }

    await c.env.SESSIONS.put(key, String(current + 1), {
      expirationTtl: opts.window * 2,
    });
    await next();
  };
}

import type { MiddlewareHandler } from "hono";
import { AppError } from "./error";

export interface RateLimitOptions {
  window: number;
  max: number;
  scope: string;
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
    const id = c.env.RATE_LIMITER.idFromName(`${opts.scope}:${ip}`);
    const stub = c.env.RATE_LIMITER.get(id);
    const url = `https://rl/check?window=${opts.window}&max=${opts.max}`;
    const res = await stub.fetch(url);
    if (res.status === 429) {
      const resetIn = res.headers.get("Retry-After") ?? "60";
      c.header("Retry-After", resetIn);
      throw new AppError(
        "RATE_LIMITED",
        `Too many requests. Retry in ${resetIn}s.`,
        429,
      );
    }
    await next();
  };
}

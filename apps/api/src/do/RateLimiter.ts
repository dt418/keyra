export interface RateLimitState {
  count: number;
  windowStart: number; // epoch seconds
}

export class RateLimiter implements DurableObject {
  private state: DurableObjectState;
  private env: { WINDOW_SECONDS?: string; MAX_REQUESTS?: string };

  constructor(state: DurableObjectState, env: { WINDOW_SECONDS?: string; MAX_REQUESTS?: string }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const window = parseInt(url.searchParams.get("window") ?? "60", 10);
    const max = parseInt(url.searchParams.get("max") ?? "20", 10);
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / window);
    const bucketKey = `b:${bucket}`;

    const cur = (await this.state.storage.get<RateLimitState>(bucketKey)) ?? {
      count: 0,
      windowStart: bucket * window,
    };
    if (cur.count >= max) {
      const resetIn = (bucket + 1) * window - now;
      return new Response(JSON.stringify({ allowed: false, resetIn }), {
        status: 429,
        headers: { "Retry-After": String(resetIn), "content-type": "application/json" },
      });
    }
    await this.state.storage.put(bucketKey, { count: cur.count + 1, windowStart: bucket * window });
    await this.state.storage.delete(`b:${bucket - 2}`);
    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}

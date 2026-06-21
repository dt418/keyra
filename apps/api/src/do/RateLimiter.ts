export interface RateLimitState {
  count: number;
}

export class RateLimiter implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let window = parseInt(url.searchParams.get("window") ?? "60", 10);
    let max = parseInt(url.searchParams.get("max") ?? "20", 10);
    if (
      !Number.isFinite(window) ||
      window <= 0 ||
      !Number.isFinite(max) ||
      max <= 0
    ) {
      return new Response(JSON.stringify({ error: "invalid window or max" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / window);
    const bucketKey = `b:${bucket}`;

    const cur = (await this.state.storage.get<RateLimitState>(bucketKey)) ?? {
      count: 0,
    };
    if (cur.count >= max) {
      const resetIn = (bucket + 1) * window - now;
      return new Response(JSON.stringify({ allowed: false, resetIn }), {
        status: 429,
        headers: {
          "Retry-After": String(resetIn),
          "content-type": "application/json",
        },
      });
    }
    await this.state.storage.put(bucketKey, { count: cur.count + 1 });
    // Delete bucket 2 windows back — already expired by now, prevents
    // unbounded storage growth.
    await this.state.storage.delete(`b:${bucket - 2}`);
    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}

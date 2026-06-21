import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../RateLimiter";

function createStorageMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createLimiter(initial?: Record<string, unknown>) {
  const storage = createStorageMock();
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      storage.get.mockImplementation((key: string) =>
        Promise.resolve(key === k ? v : null),
      );
    }
  }
  const state = { storage } as unknown as DurableObjectState;
  const limiter = new RateLimiter(state);
  return { limiter, storage };
}

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when count below max (returns 200 with allowed: true)", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=60&max=20"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { allowed: boolean };
    expect(body.allowed).toBe(true);
  });

  it("returns 429 when count already at max", async () => {
    const bucket = Math.floor(Date.now() / 1000 / 60);
    const { limiter } = createLimiter({
      [`b:${bucket}`]: { count: 20 },
    });
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=60&max=20"),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = (await res.json()) as { allowed: boolean; resetIn: number };
    expect(body.allowed).toBe(false);
    expect(body.resetIn).toBeGreaterThanOrEqual(0);
  });

  it("returns 400 when window is not a number", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=abc&max=20"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid window or max");
  });

  it("returns 400 when max is not a number", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=60&max=xyz"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid window or max");
  });

  it("returns 400 when window is 0", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=0&max=20"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid window or max");
  });

  it("returns 400 when max is 0", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=60&max=0"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid window or max");
  });

  it("returns 400 when window is negative", async () => {
    const { limiter } = createLimiter();
    const res = await limiter.fetch(
      makeRequest("https://do/check?window=-5&max=20"),
    );
    expect(res.status).toBe(400);
  });

  it("uses defaults when query params are missing", async () => {
    const { limiter, storage } = createLimiter();
    const res = await limiter.fetch(makeRequest("https://do/check"));
    expect(res.status).toBe(200);
    expect(storage.put).toHaveBeenCalledTimes(1);
    const putArg = storage.put.mock.calls[0]?.[0] as string;
    expect(putArg.startsWith("b:")).toBe(true);
  });

  it("allows requests in two consecutive buckets (bucket rollover)", async () => {
    const realDateNow = Date.now;
    const realFloor = Math.floor;
    try {
      const baseTime = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(baseTime);

      const { limiter, storage } = createLimiter();
      const res1 = await limiter.fetch(
        makeRequest("https://do/check?window=60&max=1"),
      );
      expect(res1.status).toBe(200);
      const firstBucket = realFloor(baseTime / 1000 / 60);
      expect(storage.put).toHaveBeenLastCalledWith(`b:${firstBucket}`, {
        count: 1,
      });

      vi.spyOn(Date, "now").mockReturnValue(baseTime + 60_000);
      const res2 = await limiter.fetch(
        makeRequest("https://do/check?window=60&max=1"),
      );
      expect(res2.status).toBe(200);
      const secondBucket = realFloor((baseTime + 60_000) / 1000 / 60);
      expect(secondBucket).toBe(firstBucket + 1);
      expect(storage.put).toHaveBeenLastCalledWith(`b:${secondBucket}`, {
        count: 1,
      });
    } finally {
      vi.restoreAllMocks();
      Date.now = realDateNow;
    }
  });

  it("deletes bucket 2 windows back to prevent storage growth", async () => {
    const { limiter, storage } = createLimiter();
    await limiter.fetch(makeRequest("https://do/check?window=60&max=20"));
    const bucket = Math.floor(Date.now() / 1000 / 60);
    expect(storage.delete).toHaveBeenCalledWith(`b:${bucket - 2}`);
  });

  it("uses passed-in storage state when bucket already has a count", async () => {
    const bucket = Math.floor(Date.now() / 1000 / 60);
    const { limiter, storage } = createLimiter({
      [`b:${bucket}`]: { count: 5 },
    });
    await limiter.fetch(makeRequest("https://do/check?window=60&max=20"));
    expect(storage.put).toHaveBeenCalledWith(`b:${bucket}`, { count: 6 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../rateLimit";
import { errorHandler } from "../error";

function makeEnv(disallow = false) {
  return {
    DISABLE_RATE_LIMIT: "0",
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => "id1" }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              disallow ? { allowed: false, resetIn: 30 } : { allowed: true },
            ),
            {
              status: disallow ? 429 : 200,
              headers: disallow ? { "Retry-After": "30" } : {},
            },
          ),
        ),
      }),
    },
  } as any;
}

describe("rateLimit (DO-backed)", () => {
  it("passes through when DO says allowed", async () => {
    const app = new Hono();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "test" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const env = makeEnv();
    const res = await app.request(
      "/",
      { headers: { "cf-connecting-ip": "1.1.1.1" } },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("returns 429 when DO rejects", async () => {
    const app = new Hono();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "test" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const env = makeEnv(true);
    const res = await app.request(
      "/",
      { headers: { "cf-connecting-ip": "1.1.1.1" } },
      env,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});

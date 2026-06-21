import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../rateLimit";
import { errorHandler } from "../error";

type Bindings = {
  DISABLE_RATE_LIMIT: string;
  RATE_LIMITER: Pick<DurableObjectNamespace, "idFromName" | "get">;
};

function makeEnv(disallow = false): Bindings {
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
  } as unknown as Bindings;
}

describe("rateLimit (DO-backed)", () => {
  it("passes through when DO says allowed", async () => {
    const app = new Hono<{ Bindings: Bindings }>();
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
    const app = new Hono<{ Bindings: Bindings }>();
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

  it("respectDevFlag + DISABLE_RATE_LIMIT=1 passes without calling DO", async () => {
    const env = makeEnv();
    env.DISABLE_RATE_LIMIT = "1";
    const app = new Hono<{ Bindings: Bindings }>();
    app.use(
      "/*",
      rateLimit({ window: 60, max: 20, scope: "t", respectDevFlag: true }),
    );
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    expect(env.RATE_LIMITER.get).not.toHaveBeenCalled();
  });

  it("missing cf-connecting-ip falls back to x-forwarded-for[0]", async () => {
    const env = makeEnv();
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "t" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    await app.request(
      "/",
      { headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" } },
      env,
    );
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith("t:9.9.9.9");
  });

  it("missing both headers uses 'unknown' key", async () => {
    const env = makeEnv();
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "t" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    await app.request("/", {}, env);
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith("t:unknown");
  });

  it("DO returns 4xx (non-429) returns 502", async () => {
    const env = makeEnv();
    env.RATE_LIMITER.get = vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response("bad", { status: 400 })),
    });
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "t" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(502);
  });

  it("429 without Retry-After header defaults to '60' and message 'Retry in 60s.'", async () => {
    const env = makeEnv();
    env.RATE_LIMITER.get = vi.fn().mockReturnValue({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ allowed: false }), { status: 429 }),
        ),
    });
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "t" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Retry in 60s.");
  });

  it("stub.fetch rejects returns 503 via errorHandler", async () => {
    const env = makeEnv();
    env.RATE_LIMITER.get = vi.fn().mockReturnValue({
      fetch: vi.fn().mockRejectedValue(new Error("DO down")),
    });
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "t" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(503);
  });

  it("scope isolation: 'login' vs 'verify' uses different idFromName keys", async () => {
    const env = makeEnv();
    const app = new Hono<{ Bindings: Bindings }>();
    app.use("/a", rateLimit({ window: 60, max: 20, scope: "login" }));
    app.use("/b", rateLimit({ window: 60, max: 20, scope: "verify" }));
    app.get("/a", (c) => c.json({}));
    app.get("/b", (c) => c.json({}));
    app.onError(errorHandler);
    await app.request(
      "/a",
      { headers: { "cf-connecting-ip": "1.1.1.1" } },
      env,
    );
    await app.request(
      "/b",
      { headers: { "cf-connecting-ip": "1.1.1.1" } },
      env,
    );
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith("login:1.1.1.1");
    expect(env.RATE_LIMITER.idFromName).toHaveBeenCalledWith("verify:1.1.1.1");
  });
});

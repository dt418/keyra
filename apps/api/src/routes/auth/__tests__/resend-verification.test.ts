import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "../../../middleware/error";
import { rateLimit } from "../../../middleware/rateLimit";
import { resendVerificationHandler } from "../resend-verification";
import { authRouter } from "../router";

interface KVStore {
  [key: string]: string;
}

interface UserRow {
  id: string;
  email: string;
  email_verified: number;
}

function makeEnv(opts: { user: UserRow | null }) {
  const store: KVStore = {};
  const db = {
    prepare: () => ({
      bind: () => ({
        first: async () => opts.user,
        run: async () => ({ success: true }),
        all: async () => [],
      }),
    }),
  };
  const kv = {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => {
      store[key] = value;
    },
    delete: async (key: string) => {
      delete store[key];
    },
  };
  return {
    env: {
      DB: db,
      SESSIONS: kv,
      DISABLE_RATE_LIMIT: "1",
      APP_URL: "http://localhost:5174",
    } as Record<string, unknown>,
    store,
  };
}

function makeRequest(email: string): Request {
  return new Request("http://localhost/api/v1/auth/resend-verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/email", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/email")>(
      "../../../lib/email",
    );
  return {
    ...actual,
    sendEmail: sendEmailMock,
  };
});

describe("resend-verification handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and sends a verification email when the user exists and is unverified", async () => {
    const { env, store } = makeEnv({
      user: { id: "user_1", email: "real@example.com", email_verified: 0 },
    });

    const app = new Hono();
    app.post("/api/v1/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);

    const res = await app.request(
      makeRequest("real@example.com"),
      undefined,
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { message: string } };
    expect(body.data.message).toMatch(/verification/i);

    const verifyKey = Object.keys(store).find((k) =>
      k.startsWith("verify-email:"),
    );
    if (!verifyKey) throw new Error("expected verify-email KV entry");
    const stored = JSON.parse(store[verifyKey] as string) as {
      user_id: string;
      expires_at: number;
    };
    expect(stored.user_id).toBe("user_1");
    expect(stored.expires_at).toBeGreaterThan(Date.now());

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sentTo = sendEmailMock.mock.calls[0]?.[1]?.to;
    expect(sentTo).toBe("real@example.com");
  });

  it("returns 200 but skips token issuance and email when the user is already verified", async () => {
    const { env, store } = makeEnv({
      user: { id: "user_2", email: "verified@example.com", email_verified: 1 },
    });

    const app = new Hono();
    app.post("/api/v1/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);

    const res = await app.request(
      makeRequest("verified@example.com"),
      undefined,
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { message: string } };
    expect(body.data.message).toMatch(/verification/i);

    expect(Object.keys(store)).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 200 for unknown email without revealing existence", async () => {
    const { env, store } = makeEnv({ user: null });

    const app = new Hono();
    app.post("/api/v1/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);

    const res = await app.request(
      makeRequest("nobody@example.com"),
      undefined,
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { message: string } };
    expect(body.data.message).toMatch(/verification/i);

    expect(Object.keys(store)).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email payload", async () => {
    const { env } = makeEnv({ user: null });

    const app = new Hono();
    app.post("/api/v1/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);

    const res = await app.request(
      new Request("http://localhost/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      undefined,
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("resend-verification rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when the rate-limit DO rejects the request", async () => {
    const store: KVStore = {};
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
            run: async () => ({ success: true }),
            all: async () => [],
          }),
        }),
      },
      SESSIONS: {
        get: async (key: string) => store[key] ?? null,
        put: async (key: string, value: string) => {
          store[key] = value;
        },
        delete: async (key: string) => {
          delete store[key];
        },
      },
      DISABLE_RATE_LIMIT: "0",
      APP_URL: "http://localhost:5174",
      RATE_LIMITER: {
        idFromName: vi.fn().mockReturnValue({ toString: () => "id" }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ allowed: false, resetIn: 45 }), {
              status: 429,
              headers: { "Retry-After": "45" },
            }),
          ),
        }),
      },
    } as Record<string, unknown>;

    const app = new Hono();
    app.post(
      "/api/v1/auth/resend-verification",
      rateLimit({
        window: 60,
        max: 5,
        scope: "resend-verification",
      }),
      resendVerificationHandler,
    );
    app.onError(errorHandler);

    const res = await app.request(
      makeRequest("real@example.com"),
      undefined,
      env,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("mounts resend-verification under /auth in the authRouter with a 5/min rate limit", async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
            run: async () => ({ success: true }),
            all: async () => [],
          }),
        }),
      },
      SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
      DISABLE_RATE_LIMIT: "0",
      APP_URL: "http://localhost:5174",
      RATE_LIMITER: {
        idFromName: vi.fn().mockImplementation((name: string) => ({
          toString: () => name,
        })),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockImplementation((url: string) => {
            if (url.includes("scope-not-allowed")) {
              return Promise.resolve(
                new Response(JSON.stringify({ allowed: true }), {
                  status: 200,
                }),
              );
            }
            return Promise.resolve(
              new Response(JSON.stringify({ allowed: false, resetIn: 7 }), {
                status: 429,
                headers: { "Retry-After": "7" },
              }),
            );
          }),
        }),
      },
    } as Record<string, unknown>;

    const app = new Hono();
    app.onError(errorHandler);
    app.route("/", authRouter);
    const res = await app.request(
      new Request("http://localhost/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "real@example.com" }),
      }),
      undefined,
      env,
    );
    expect(res.status).toBe(429);
    const rateLimiter = env.RATE_LIMITER as unknown as {
      idFromName: ReturnType<typeof vi.fn>;
    };
    expect(rateLimiter.idFromName).toHaveBeenCalledWith(
      expect.stringMatching(/^resend-verification:/),
    );
  });
});

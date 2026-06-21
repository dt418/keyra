import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import { errorHandler } from "../../../middleware/error";
import { registerHandler } from "../register";
import { verifyEmailHandler, issueVerificationToken } from "../verify-email";

interface KVStore {
  [key: string]: string;
}

function makeExecutionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  };
}

function makeEnv(
  opts: {
    emailVerified?: number;
    putFail?: boolean;
    getFail?: boolean;
  } = {},
) {
  const store: KVStore = {};
  const updateCalls: Array<{ sql: string; args: unknown[] }> = [];

  const sqlMatchers = {
    updateUserVerified: /UPDATE users SET email_verified = 1 WHERE id = \?/,
    selectUserByEmail: /SELECT id FROM users WHERE email = \?/,
  } as const;

  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sqlMatchers.updateUserVerified.test(sql)) {
            updateCalls.push({ sql, args });
            return { id: args[0] };
          }
          if (sqlMatchers.selectUserByEmail.test(sql)) {
            return null;
          }
          return null;
        },
        run: async () => {
          if (sqlMatchers.updateUserVerified.test(sql)) {
            updateCalls.push({ sql, args });
          }
          return { success: true };
        },
        all: async () => [],
      }),
    }),
  };

  const kv = {
    get: async (key: string) => (opts.getFail ? null : (store[key] ?? null)),
    put: async (key: string, value: string) => {
      if (opts.putFail) throw new Error("kv put failed");
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
      JWT_SECRET: "test",
      JWT_REFRESH_SECRET: "test-refresh",
      APP_URL: "http://localhost:5174",
    },
    store,
    getUpdateCalls: () => updateCalls,
  };
}

function makeRegisterRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeVerifyRequest(token: string): Request {
  return new Request(`http://localhost/api/v1/auth/verify-email/${token}`);
}

describe("register → verify-email integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("issues a KV token on register, then verify-email/:token flips email_verified=1", async () => {
    const ctx = makeEnv();

    const app = new Hono();
    app.post("/api/v1/auth/register", registerHandler);
    app.get("/api/v1/auth/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const regRes = await app.request(
      makeRegisterRequest({
        email: "flow@example.com",
        password: "password123",
        name: "Flow User",
      }),
      undefined,
      ctx.env,
      makeExecutionCtx(),
    );
    expect(regRes.status).toBe(201);

    const verifyKey = Object.keys(ctx.store).find((k) =>
      k.startsWith("verify-email:"),
    );
    expect(verifyKey).toBeDefined();
    const token = (verifyKey as string).replace("verify-email:", "");
    const storedRaw = ctx.store[verifyKey as string] ?? "{}";
    const stored = JSON.parse(storedRaw) as {
      user_id: string;
      expires_at: number;
    };
    expect(stored.user_id).toEqual(expect.any(String));
    expect(stored.expires_at).toBeGreaterThan(Date.now());

    const verRes = await app.request(
      makeVerifyRequest(token),
      undefined,
      ctx.env,
      makeExecutionCtx(),
    );
    expect(verRes.status).toBe(200);
    const verBody = (await verRes.json()) as { data: { verified: boolean } };
    expect(verBody.data.verified).toBe(true);

    const updates = ctx.getUpdateCalls();
    expect(updates.length).toBe(1);
    expect(updates[0]?.sql).toMatch(/UPDATE users SET email_verified = 1/);
    expect(updates[0]?.args[0]).toBe(stored.user_id);

    expect(ctx.store[`verify-email:${token}`]).toBeUndefined();
  });

  it("rejects a verify-email call for a token that was never issued", async () => {
    const ctx = makeEnv();
    const app = new Hono();
    app.get("/api/v1/auth/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const res = await app.request(
      makeVerifyRequest("ghost-token"),
      undefined,
      ctx.env,
      makeExecutionCtx(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
  });

  it("rejects a verify-email call after the token is deleted by a second click", async () => {
    const ctx = makeEnv();
    const app = new Hono();
    app.get("/api/v1/auth/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const userId = "user_abc";
    await issueVerificationToken(
      ctx.env.SESSIONS as unknown as KVNamespace,
      userId,
    );
    const key = Object.keys(ctx.store).find((k) =>
      k.startsWith("verify-email:"),
    );
    expect(key).toBeDefined();
    const token = (key as string).replace("verify-email:", "");

    const first = await app.request(
      makeVerifyRequest(token),
      undefined,
      ctx.env,
      makeExecutionCtx(),
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      makeVerifyRequest(token),
      undefined,
      ctx.env,
      makeExecutionCtx(),
    );
    expect(second.status).toBe(400);
  });
});

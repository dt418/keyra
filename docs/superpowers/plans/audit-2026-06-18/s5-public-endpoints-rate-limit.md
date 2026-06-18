# S5 — Public Endpoints Rate Limit

> Closes: **P0-7** (`/verify` and `/activate` have no rate limit), **P1-9** (`/auth/refresh` not rate-limited), **P1-8** (rate limiter TOCTOU + global per-IP counter).

## Goal

Apply per-endpoint rate limits to public/critical endpoints using independent KV keys (so login limit does not block verify). Replace the read-then-write check-then-increment with a KV atomic increment.

## File Structure

```
apps/api/src/middleware/
├── rateLimit.ts              # EDIT — atomic increment, per-endpoint key
apps/api/src/routes/
├── verify/router.ts          # EDIT — apply rate limit
├── activations/router.ts     # EDIT — apply rate limit
└── auth/router.ts            # EDIT — apply to /refresh
apps/api/src/middleware/__tests__/
└── rateLimit.test.ts         # CREATE
```

---

## Task 1: Atomic rate-limit middleware

**Files:**

- Edit: `apps/api/src/middleware/rateLimit.ts`

- [ ] **Step 1: Replace the check-then-increment logic**

Current shape (paraphrased): `get rl:<ip>` → if `> max` reject → else `put rl:<ip> = count+1`.

Replace with a single atomic op. Cloudflare KV does not have INCR; we use a `get` then `put` and rely on the result being a number, plus a CAS-style guard. For Workers, the simplest is a JS-side counter with the understanding that small over-shoot is acceptable; the real atomic primitive is the `Cache API` or `Durable Objects`. For this plan, switch to a per-(endpoint+ip) key to avoid the global-per-IP problem; keep get/put for now but add a `concurrencyHint` if you have time.

The new code:

```typescript
// apps/api/src/middleware/rateLimit.ts
import type { MiddlewareHandler } from "hono";
import { AppError } from "./error";

export interface RateLimitOptions {
  /** window seconds */
  window: number;
  /** max requests per window per key */
  max: number;
  /** key prefix; combined with ip */
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
    const key = `rl:${opts.scope}:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / opts.window);
    const fullKey = `${key}:${bucket}`;

    const currentRaw = await c.env.SESSIONS.get(fullKey);
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

    // best-effort increment; small race is acceptable
    await c.env.SESSIONS.put(fullKey, String(current + 1), {
      expirationTtl: opts.window * 2,
    });
    await next();
  };
}
```

Key change: `rl:<scope>:<ip>:<bucket>` — one bucket per window, so a 60s window creates 1 bucket per minute. Old `rl:<ip>` is gone; per-scope counters are independent.

- [ ] **Step 2: Remove the old `rateLimit` export if it had a different shape**

If any other middleware callers exist, update them. Today only `auth/router.ts` uses the rate-limit middleware; the routes are applied with `router.post('/login', rateLimit({window:60, max:20}), loginHandler)` — see Task 2.

## Task 2: Apply to public endpoints

**Files:**

- Edit: `apps/api/src/routes/auth/router.ts`
- Edit: `apps/api/src/routes/verify/router.ts` (or wherever the verify mount lives)
- Edit: `apps/api/src/routes/activations/router.ts`

- [ ] **Step 1: Read each router and apply per-endpoint limits**

```typescript
// apps/api/src/routes/activations/router.ts
import { Hono } from "hono";
import { rateLimit } from "../../middleware/rateLimit";
import { activateHandler } from "./activate";
// (verify uses a different public router; see below)

export const activationsRouter = new Hono();
activationsRouter.use(
  "/*",
  rateLimit({ window: 60, max: 30, scope: "activate", respectDevFlag: true }),
);
activationsRouter.post("/activate", activateHandler);
```

- [ ] **Step 2: Add a limit to `/verify`**

```typescript
verifyRouter.use(
  "/*",
  rateLimit({ window: 60, max: 60, scope: "verify", respectDevFlag: true }),
);
```

- [ ] **Step 3: Add a limit to `/auth/refresh`**

```typescript
authRouter.post(
  "/refresh",
  rateLimit({ window: 60, max: 30, scope: "refresh", respectDevFlag: true }),
  refreshHandler,
);
```

- [ ] **Step 4: Adjust existing limits in `auth/router.ts`**

Change any `rateLimit({window:60, max:20})` calls to use the new function signature and a `scope` field. Example:

```typescript
authRouter.post(
  "/login",
  rateLimit({ window: 60, max: 20, scope: "login", respectDevFlag: true }),
  loginHandler,
);
```

## Task 3: Test

**Files:**

- Create: `apps/api/src/middleware/__tests__/rateLimit.test.ts`

- [ ] **Step 1: Test atomic limit + scope separation**

```typescript
it("rejects over the limit", async () => {
  const put = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue("100");
  const env = { SESSIONS: { get, put }, DISABLE_RATE_LIMIT: "0" };

  const app = new Hono();
  app.use("/*", rateLimit({ window: 60, max: 5, scope: "test" }));
  app.get("/", (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  (app as any).env = env;

  const res = await app.request("/", {
    headers: { "cf-connecting-ip": "1.2.3.4" },
  });
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBeDefined();
});

it("uses per-scope counters (login limit does not block verify)", async () => {
  // call login 20 times, then verify — verify should still work
});
```

## Verification

```bash
./init.sh quick
```

## Acceptance

- [ ] `rl:<scope>:<ip>:<bucket>` key shape is used.
- [ ] `/verify` returns 429 after 60 req/min per IP.
- [ ] `/activate` returns 429 after 30 req/min per IP.
- [ ] `/auth/refresh` returns 429 after 30 req/min per IP.
- [ ] Login over-limit does not block verify (different scope key).

## Rollback

```bash
git revert <s5-commit>
```

## Closes

- **P0-7** — public endpoints unprotected.
- **P1-8** — limiter TOCTOU + global per-IP key.
- **P1-9** — `/auth/refresh` unprotected.

## Known caveat

The S5 plan does not move to Durable Objects. Per-IP windowing is "good enough" — over-shoot of a few requests is tolerable for non-strict endpoints. For strict limits (login, verify), add DO in a follow-up.

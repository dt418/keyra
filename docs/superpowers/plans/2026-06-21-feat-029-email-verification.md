# feat-029 — Email Verification Flow

> Builds on **feat-026** (S7 stub at `apps/api/src/routes/auth/verify-email.ts` throws `NOT_IMPLEMENTED` 501).
> Replaces the stub with a real token-based verification backed by Cloudflare KV + Resend transactional email.

## Goal

End-users who register with email + password receive a verification email containing a single-use token link. Clicking the link flips `users.email_verified = 1`. Resend-verification is rate-limited. Optional env flag blocks login until verified.

## Architecture

- **Token store:** Cloudflare KV (`SESSIONS` binding) under `verify:<token>` → `{ user_id, expires_at }`. 24h TTL set at put time.
- **Sender:** Resend HTTP API (`POST https://api.resend.com/emails`). Single fetch in `apps/api/src/lib/email.ts`.
- **Templates:** Plain-text + minimal HTML in `apps/api/src/lib/email-templates/verify.ts`. No React Email — keep deps flat.
- **Login gate:** Toggle via `REQUIRE_EMAIL_VERIFICATION=1` env var. Off by default for backwards-compat with existing seeded users (which have `email_verified=0`).
- **Test mocks:** `vi.mock` the `sendEmail` helper — never hit Resend in unit tests.

## File Structure

```
apps/api/src/
├── lib/
│   ├── email.ts                            # CREATE — Resend client + sendVerification()
│   └── email-templates/
│       └── verify.ts                       # CREATE — text + HTML
├── routes/auth/
│   ├── verify-email.ts                     # EDIT — real implementation
│   ├── resend-verification.ts              # CREATE — POST /auth/resend-verification
│   ├── register.ts                         # EDIT — enqueue verification email
│   ├── login.ts                            # EDIT — honor REQUIRE_EMAIL_VERIFICATION
│   ├── router.ts                           # EDIT — mount /resend-verification
│   └── __tests__/
│       ├── verify-email.test.ts            # CREATE
│       └── resend-verification.test.ts     # CREATE
├── middleware/
│   └── error.ts                            # EDIT — add EMAIL_NOT_VERIFIED error code
apps/api/.env.example                       # EDIT — add RESEND_API_KEY, RESEND_FROM_EMAIL, REQUIRE_EMAIL_VERIFICATION
docs/API_SPEC.md                            # EDIT — document endpoints + EMAIL_NOT_VERIFIED
docs/ARCHITECTURE.md                        # EDIT — env var table
```

---

## Task 1: Token model + KV lifecycle

**Files:**

- Create: `apps/api/src/lib/email.ts`
- Create: `apps/api/src/routes/auth/__tests__/verify-email.test.ts`

- [ ] **Step 1: Write failing test for the verify-email endpoint (happy path)**

```typescript
// apps/api/src/routes/auth/__tests__/verify-email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { verifyEmailHandler } from "../verify-email";
import { errorHandler } from "../../../middleware/error";
import type { Env } from "../../../index";

const putKV = vi.fn().mockResolvedValue(undefined);
const getKV = vi.fn();
const deleteKV = vi.fn().mockResolvedValue(undefined);
const first = vi.fn();

function makeEnv(overrides: Partial<{ emailVerified: number; kvValue: string | null }> = {}) {
  return {
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes("UPDATE users SET email_verified")) {
              return { id: args[0] };
            }
            return { id: "user_1", email_verified: overrides.emailVerified ?? 0 };
          },
          run: async () => ({ success: true }),
          all: async () => [],
        }),
      }),
    },
    SESSIONS: {
      get: getKV.mockImplementation(async () => overrides.kvValue ?? null),
      put: putKV,
      delete: deleteKV,
    },
  } as unknown as Env;
}

describe("verify-email handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips email_verified to 1 on a valid unexpired token, deletes the KV entry, and returns 200", async () => {
    getKV.mockResolvedValueOnce(
      JSON.stringify({ user_id: "user_1", expires_at: Date.now() + 60_000 }),
    );
    const app = new Hono();
    app.get("/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const res = await app.request("/verify-email/abc123", {}, makeEnv());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ verified: true });
    expect(deleteKV).toHaveBeenCalledWith("verify:abc123");
  });

  it("rejects expired tokens with 400 EMAIL_VERIFICATION_EXPIRED and does not touch the user", async () => {
    getKV.mockResolvedValueOnce(
      JSON.stringify({ user_id: "user_1", expires_at: Date.now() - 1000 }),
    );
    const app = new Hono();
    app.get("/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const res = await app.request("/verify-email/expired", {}, makeEnv());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("EMAIL_VERIFICATION_EXPIRED");
    expect(deleteKV).toHaveBeenCalledWith("verify:expired");
  });

  it("rejects unknown tokens with 400 EMAIL_VERIFICATION_INVALID", async () => {
    getKV.mockResolvedValueOnce(null);
    const app = new Hono();
    app.get("/verify-email/:token", verifyEmailHandler);
    app.onError(errorHandler);

    const res = await app.request("/verify-email/nope", {}, makeEnv());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("EMAIL_VERIFICATION_INVALID");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails (handler not implemented)**

```bash
pnpm --filter @keyra/api test -- verify-email
```

Expected: `Cannot find module '../verify-email'` or stub throws `NOT_IMPLEMENTED`.

- [ ] **Step 3: Create `apps/api/src/lib/email.ts` — Resend client + token helpers**

```typescript
// apps/api/src/lib/email.ts
export interface VerificationEmail {
  to: string;
  token: string;
  verifyUrl: string;
}

export async function sendVerificationEmail(env: { RESEND_API_KEY: string; RESEND_FROM_EMAIL: string }, msg: VerificationEmail): Promise<void> {
  const subject = "Verify your Keyra account";
  const html = renderVerifyHtml(msg);
  const text = renderVerifyText(msg);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: msg.to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
}

export async function issueVerificationToken(
  kv: KVNamespace,
  userId: string,
  ttlSeconds = 60 * 60 * 24,
): Promise<string> {
  const token = crypto.randomUUID();
  await kv.put(
    `verify:${token}`,
    JSON.stringify({ user_id: userId, expires_at: Date.now() + ttlSeconds * 1000 }),
    { expirationTtl: ttlSeconds },
  );
  return token;
}
```

- [ ] **Step 4: Create `apps/api/src/lib/email-templates/verify.ts`**

```typescript
// apps/api/src/lib/email-templates/verify.ts
import type { VerificationEmail } from "../email";

export function renderVerifyText({ verifyUrl }: VerificationEmail): string {
  return [
    "Welcome to Keyra.",
    "",
    "Confirm your email by opening the link below (valid 24h):",
    verifyUrl,
    "",
    "If you did not sign up, ignore this message.",
  ].join("\n");
}

export function renderVerifyHtml({ verifyUrl }: VerificationEmail): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;padding:24px">
  <h1 style="margin:0 0 16px">Welcome to Keyra</h1>
  <p>Confirm your email by clicking the button below. The link is valid for 24 hours.</p>
  <p style="margin:24px 0"><a href="${verifyUrl}" style="background:#5b21b6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>
  <p style="color:#6b7280;font-size:13px">If the button does not work, paste this URL: <br>${verifyUrl}</p>
</body></html>`;
}
```

- [ ] **Step 5: Replace the stub `verify-email.ts` with the real handler**

```typescript
// apps/api/src/routes/auth/verify-email.ts
import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import type { Env } from "../../index";

interface StoredToken {
  user_id: string;
  expires_at: number;
}

export async function verifyEmailHandler(c: Context<{ Bindings: Env }>) {
  const token = c.req.param("token");
  if (!token) throw new AppError("BAD_REQUEST", "Missing token", 400);

  const raw = await c.env.SESSIONS.get(`verify:${token}`);
  if (!raw) throw new AppError("EMAIL_VERIFICATION_INVALID", "Verification link is invalid or has been used", 400);

  const stored = JSON.parse(raw) as StoredToken;
  await c.env.SESSIONS.delete(`verify:${token}`);

  if (stored.expires_at < Date.now()) {
    throw new AppError("EMAIL_VERIFICATION_EXPIRED", "Verification link expired", 400);
  }

  await c.env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(stored.user_id).run();
  return c.json({ data: { verified: true } });
}
```

- [ ] **Step 6: Add error codes to `apps/api/src/middleware/error.ts`**

In the AppError section that maps codes to default HTTP statuses, add:

```typescript
"EMAIL_VERIFICATION_INVALID": 400,
"EMAIL_VERIFICATION_EXPIRED": 400,
"EMAIL_NOT_VERIFIED": 403,
"EMAIL_SEND_FAILED": 502,
```

- [ ] **Step 7: Run test — confirm pass**

```bash
pnpm --filter @keyra/api test -- verify-email
```

Expected: 3/3 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/email.ts apps/api/src/lib/email-templates/verify.ts apps/api/src/routes/auth/verify-email.ts apps/api/src/middleware/error.ts apps/api/src/routes/auth/__tests__/verify-email.test.ts
git commit -m "feat(verify-email): token verify + Resend sender"
```

## Task 2: Send verification email on register

**Files:**

- Edit: `apps/api/src/routes/auth/register.ts`
- Edit: `apps/api/.env.example`

- [ ] **Step 1: Add env vars to `.env.example`**

```bash
# apps/api/.env.example
# Email verification
RESEND_API_KEY=
RESEND_FROM_EMAIL="Keyra <noreply@keyra.example>"
REQUIRE_EMAIL_VERIFICATION=0
```

- [ ] **Step 2: Update register handler to issue token + send email**

In `apps/api/src/routes/auth/register.ts`, after the user INSERT succeeds and before the JWT mint, add:

```typescript
import { issueVerificationToken, sendVerificationEmail } from "../../lib/email";

// ... after `const user = await insertResult.first();` and before mintToken:
if (user?.id) {
  const token = await issueVerificationToken(c.env.SESSIONS, user.id);
  const verifyUrl = `${new URL(c.req.url).origin}/verify-email/${token}`;
  await sendVerificationEmail(c.env, { to: user.email, token, verifyUrl }).catch((err) => {
    console.error("[verify-email] send failed", err);
  });
}
```

Note: do not block registration on send failure — log and continue. Returning a 500 because Resend is down would lock users out.

- [ ] **Step 3: Manual smoke test (local)**

```bash
# in another terminal: pnpm dev:api
curl -s -X POST http://localhost:8788/api/v1/auth/register \
  -H "content-type: application/json" \
  -d '{"email":"smoke@example.com","password":"correcthorsebatterystaple","name":"Smoke"}'
```

Expected: 201. KV `verify:<token>` entry exists (inspect via `wrangler kv:key list --binding=SESSIONS`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/auth/register.ts apps/api/.env.example
git commit -m "feat(register): send verification email on signup"
```

## Task 3: Resend verification endpoint

**Files:**

- Create: `apps/api/src/routes/auth/resend-verification.ts`
- Create: `apps/api/src/routes/auth/__tests__/resend-verification.test.ts`
- Edit: `apps/api/src/routes/auth/router.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/api/src/routes/auth/__tests__/resend-verification.test.ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { resendVerificationHandler } from "../resend-verification";
import { errorHandler } from "../../../middleware/error";
import type { Env } from "../../../index";

vi.mock("../../../lib/email", () => ({
  issueVerificationToken: vi.fn().mockResolvedValue("tok_xyz"),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

function makeEnv(user: { id: string; email: string } | null) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => user,
          run: async () => ({ success: true }),
          all: async () => [],
        }),
      }),
    },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  } as unknown as Env;
}

describe("resend-verification", () => {
  it("returns 200 even for unknown email (no enumeration)", async () => {
    const app = new Hono();
    app.use("/*", async (c, next) => { (c as any).userId = "u1"; await next(); });
    app.post("/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);
    const res = await app.request("/auth/resend-verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "nobody@example.com" }) }, makeEnv(null));
    expect(res.status).toBe(200);
  });

  it("issues a token and sends email when the user exists", async () => {
    const emailMod = await import("../../../lib/email");
    const app = new Hono();
    app.use("/*", async (c, next) => { (c as any).userId = "u1"; await next(); });
    app.post("/auth/resend-verification", resendVerificationHandler);
    app.onError(errorHandler);
    const res = await app.request("/auth/resend-verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "real@example.com" }) }, makeEnv({ id: "u1", email: "real@example.com" }));
    expect(res.status).toBe(200);
    expect(emailMod.issueVerificationToken).toHaveBeenCalled();
    expect(emailMod.sendVerificationEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement handler**

```typescript
// apps/api/src/routes/auth/resend-verification.ts
import { z } from "zod";
import type { Context } from "hono";
import { issueVerificationToken, sendVerificationEmail } from "../../lib/email";
import { AppError } from "../../middleware/error";
import type { Env } from "../../index";

const schema = z.object({ email: z.string().email() });

export async function resendVerificationHandler(c: Context<{ Bindings: Env }>) {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid email", 400);

  const row = await c.env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(parsed.data.email).first<{ id: string; email: string }>();
  // Always 200 — do not leak existence
  if (row) {
    const token = await issueVerificationToken(c.env.SESSIONS, row.id);
    const verifyUrl = `${new URL(c.req.url).origin}/verify-email/${token}`;
    await sendVerificationEmail(c.env, { to: row.email, token, verifyUrl }).catch((err) => {
      console.error("[resend-verification] send failed", err);
    });
  }
  return c.json({ data: { sent: true } });
}
```

- [ ] **Step 3: Mount in router**

In `apps/api/src/routes/auth/router.ts`:

```typescript
import { resendVerificationHandler } from "./resend-verification";

// inside the authRouter:
authRouter.post("/resend-verification", rateLimit({ window: 60, max: 5, scope: "resend-verification", respectDevFlag: true }), resendVerificationHandler);
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @keyra/api test -- resend-verification
```

Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/auth/resend-verification.ts apps/api/src/routes/auth/__tests__/resend-verification.test.ts apps/api/src/routes/auth/router.ts
git commit -m "feat(auth): resend verification email endpoint"
```

## Task 4: Login gate (env-toggled)

**Files:**

- Edit: `apps/api/src/routes/auth/login.ts`
- Create: `apps/api/src/routes/auth/__tests__/login-email-gate.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/api/src/routes/auth/__tests__/login-email-gate.test.ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { loginHandler } from "../login";
import { errorHandler } from "../../../middleware/error";

vi.mock("../../../lib/password", () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

function makeEnv(opts: { verified: number; requireFlag: string }) {
  return {
    REQUIRE_EMAIL_VERIFICATION: opts.requireFlag,
    DB: {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => ({ id: "u1", email: "e@e.com", password_hash: "h", email_verified: opts.verified }),
          run: async () => ({ success: true }),
          all: async () => [],
        }),
      }),
    },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    JWT_SECRET: "test",
  } as any;
}

describe("login email-verification gate", () => {
  it("blocks login when REQUIRE_EMAIL_VERIFICATION=1 and email_verified=0", async () => {
    const app = new Hono();
    app.post("/login", loginHandler);
    app.onError(errorHandler);
    const res = await app.request("/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "e@e.com", password: "p" }) }, makeEnv({ verified: 0, requireFlag: "1" }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("allows login when flag is off even if email_verified=0", async () => {
    const app = new Hono();
    app.post("/login", loginHandler);
    app.onError(errorHandler);
    const res = await app.request("/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "e@e.com", password: "p" }) }, makeEnv({ verified: 0, requireFlag: "0" }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Add gate to login handler**

At the top of `loginHandler`, after the user lookup and password verify, before issuing JWT:

```typescript
if (c.env.REQUIRE_EMAIL_VERIFICATION === "1" && user.email_verified === 0) {
  throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before logging in", 403);
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @keyra/api test -- login-email-gate
```

Expected: 2/2 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/auth/login.ts apps/api/src/routes/auth/__tests__/login-email-gate.test.ts
git commit -m "feat(login): gate login behind email verification"
```

## Task 5: Docs

**Files:**

- Edit: `docs/API_SPEC.md`
- Edit: `docs/ARCHITECTURE.md`
- Edit: `README.md` (env table)

- [ ] **Step 1: Add endpoints to `docs/API_SPEC.md`**

Under the auth section:

```
POST /api/v1/auth/resend-verification   Rate limit 5/min. Body: { email }. Always returns 200.
GET  /api/v1/auth/verify-email/:token   Public. Returns 200 on success, 400 on invalid/expired.
```

Add error codes:

```
EMAIL_VERIFICATION_INVALID  400  Unknown / already-used token
EMAIL_VERIFICATION_EXPIRED  400  Token past expires_at
EMAIL_NOT_VERIFIED          403  REQUIRE_EMAIL_VERIFICATION=1 and user.email_verified=0
EMAIL_SEND_FAILED           502  Resend returned non-2xx
```

- [ ] **Step 2: Update env table in `docs/ARCHITECTURE.md`**

```markdown
| `RESEND_API_KEY`           | Email sender token                                          | secret |
| `RESEND_FROM_EMAIL`        | From address used in outgoing mail                          | string |
| `REQUIRE_EMAIL_VERIFICATION` | `1` blocks login until `email_verified=1`; default `0`     | string |
```

- [ ] **Step 3: Update `README.md` env table** — add the 3 vars to the "Email" section.

- [ ] **Step 4: Commit**

```bash
git add docs/API_SPEC.md docs/ARCHITECTURE.md README.md
git commit -m "docs(email): verify-email endpoints + env vars"
```

## Verification

```bash
./init.sh quick
```

Expected: all unit tests + typecheck pass. New tests: 7 (3 verify-email + 2 resend + 2 login gate).

## Acceptance

- [ ] `GET /auth/verify-email/:token` flips `email_verified=1` for a valid token and returns 400 for invalid/expired.
- [ ] `POST /auth/register` issues a `verify:<token>` KV entry with 24h TTL and sends a verification email.
- [ ] `POST /auth/resend-verification` returns 200 in all cases (no enumeration) and emails the user when the account exists.
- [ ] When `REQUIRE_EMAIL_VERIFICATION=1`, login returns 403 `EMAIL_NOT_VERIFIED` for unverified users.
- [ ] Resend API call is mocked in tests — no real network in CI.
- [ ] All responses snake_case.

## Rollback

```bash
git revert feat-029-verify-email-handler feat-029-register-send-email feat-029-resend-endpoint feat-029-login-gate feat-029-docs
```

Reverts are safe because the KV entries have TTL and existing users with `email_verified=0` are not blocked unless the env flag is on.

## Out of scope

- Email change flow (a separate `feat-email-change`).
- Bounce / unsubscribe handling.
- Custom DKIM / SPF setup (handled by Resend domain config, not code).
- React Email templates — keep deps flat for now.

# S7 — Auth Flow Hygiene

> Closes: **P1-1** (OAuth callback `redirectUri` defaults to `''`), **P1-2** (login timing leak), **P1-3** (register `email_verified=1` without verification), **P1-5** (org delete leaves orphan audit rows).

## Goal

Four small, focused cleanups:

1. OAuth callback requires `OAUTH_REDIRECT_URI` env var (no empty default).
2. Login handler returns in constant time (or near-constant) regardless of whether the user exists.
3. Register sets `email_verified=0` and adds a `verify_email` endpoint that flips it (out of scope of this plan; this plan only flips the default).
4. Org delete is atomic and orphans no audit rows (delete audit rows by `org_id` if `audit_logs.org_id` is set, or accept orphans with a documented decision).

## File Structure

```
apps/api/src/routes/auth/
├── login.ts                  # EDIT — constant-time-ish
├── register.ts               # EDIT — email_verified=0
└── verify-email.ts           # CREATE — stub: email_token row + endpoint
apps/api/src/routes/orgs/
└── delete.ts                 # EDIT — clean up audit rows
database/migrations/
└── 0013_cleanup_orphan_audit.sql  # CREATE — adds FK or documents retention
```

---

## Task 1: OAuth redirect URI required

**Files:**

- Edit: `apps/api/src/routes/auth/oauth.ts`

- [ ] **Step 1: Replace empty default with hard failure**

Line 174 currently:

```typescript
const redirectUri = (c.env.OAUTH_REDIRECT_URI as string | undefined) ?? "";
```

Replace with:

```typescript
const redirectUri = c.env.OAUTH_REDIRECT_URI as string | undefined;
if (!redirectUri) {
  throw new AppError(
    "OAUTH_NOT_CONFIGURED",
    "OAuth is not configured on this server. Set OAUTH_REDIRECT_URI in wrangler secrets.",
    500,
  );
}
```

Apply the same guard in `oauthInitiateHandler` (around line 325 of the original).

## Task 2: Login constant-time-ish

**Files:**

- Edit: `apps/api/src/routes/auth/login.ts`

- [ ] **Step 1: Add a dummy bcrypt verify on user-not-found**

Lines 29-36 currently early-return on user-not-found, leaking via timing. To minimize the leak, also call `verifyPassword` against a fixed dummy hash when the user is missing:

```typescript
const DUMMY_HASH = "$2a$12$" + "A".repeat(53); // valid bcrypt shape with low cost; will always fail

if (!user) {
  await verifyPassword(password, DUMMY_HASH); // same cost as a real check
  throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
}
```

Note: this only narrows the leak by the bcrypt CPU cost; the early DB-return-vs-DB-miss is still observable via the DB timing. Real constant-time login needs a D1 pre-warm or an argon2-with-fixed-cost edge. For this plan, the bcrypt padding is the right pragmatic step.

- [ ] **Step 2: Document the residual leak**

Add a comment in `login.ts` explaining: "D1 user-not-found timing leak remains. Acceptable for v1; revisit with D1 warm-up or pre-fetch."

## Task 3: Register sets `email_verified=0`

**Files:**

- Edit: `apps/api/src/routes/auth/register.ts`
- Edit: `database/migrations/0001_users.sql` — UNCHANGED (default is already 0)
- New file: `apps/api/src/routes/auth/verify-email.ts` (stub)
- New migration: `database/migrations/0013_email_verification.sql`

- [ ] **Step 1: Change the INSERT to set `email_verified=0`**

In `register.ts` line 39-43, change:

```typescript
await c.env.DB.prepare(
  `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
   VALUES (?, ?, ?, ?, 1, ?, ?)`,
);
```

to:

```typescript
await c.env.DB.prepare(
  `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
   VALUES (?, ?, ?, ?, 0, ?, ?)`,
);
```

- [ ] **Step 2: Add a `verify_email` table (migration)**

`database/migrations/0013_email_verification.sql`:

```sql
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);
```

- [ ] **Step 3: Stub the verify-email endpoint**

`apps/api/src/routes/auth/verify-email.ts`:

```typescript
import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function verifyEmailHandler(c: Context) {
  const { token } = c.req.param();
  if (!token) throw new AppError("BAD_REQUEST", "Missing token", 400);

  // TODO(feat): validate token_hash, flip users.email_verified, mark used_at
  throw new AppError(
    "NOT_IMPLEMENTED",
    "Email verification is not yet enabled",
    501,
  );
}
```

Mount in `auth/router.ts` (under a path that does NOT require auth): `authRouter.get('/verify-email/:token', verifyEmailHandler)`. The full email-send flow is deferred to a follow-up plan; this plan only flips the default and adds the table.

- [ ] **Step 4: Update the OAuth path to set `email_verified=1`**

OAuth already sets `email_verified=1` because the provider has verified the email. Leave that path alone.

## Task 4: Org delete cleans up

**Files:**

- Edit: `apps/api/src/routes/orgs/delete.ts`
- Edit: `database/migrations/0014_audit_logs_fk.sql` (new) OR document the retention choice

- [ ] **Step 1: Add a manual DELETE for audit_logs before the org delete**

In `delete.ts`, before deleting `org_members` and `organizations`:

```typescript
await c.env.DB.prepare("DELETE FROM audit_logs WHERE org_id = ?")
  .bind(orgId)
  .run();
```

This orphans nothing. Alternative: keep audit rows for compliance and add a soft-delete flag; that's a product decision. The plan takes the simple path (delete) and documents the choice.

- [ ] **Step 2: Update the comment in 0006_audit_logs.sql**

Edit `database/migrations/0006_audit_logs.sql` line 1-2 to add a note that `org_id` is intentionally not a FK (audit trail survives org deletion by default), and that `routes/orgs/delete.ts` is the manual cleanup site. This is documentation only.

## Verification

```bash
./init.sh quick
# also test e2e: e2e/auth.spec.ts should still pass (no email-verification check in the existing flows)
```

## Acceptance

- [ ] OAuth callback rejects when `OAUTH_REDIRECT_URI` env var is missing.
- [ ] Login runs a dummy bcrypt on user-not-found (measurable via timing instrumentation; CI does not assert).
- [ ] Register sets `email_verified=0`.
- [ ] `email_verification_tokens` table exists; `verify-email` endpoint exists (returns 501).
- [ ] Org delete removes audit_logs for that org first.

## Rollback

```bash
git revert <s7-commit>
# the email_verification_tokens migration is idempotent (IF NOT EXISTS) so down-migration not required
```

## Closes

- **P1-1** — OAuth callback default empty redirect_uri.
- **P1-2** — login timing leak (narrowed, not eliminated).
- **P1-3** — register `email_verified=1` without verification.
- **P1-5** — org delete leaves orphan audit rows.

## Out of scope (deferred)

- Sending verification emails (Resend integration; needs product decision).
- Email templates.
- A real D1 warm-up to fully close the login timing leak.

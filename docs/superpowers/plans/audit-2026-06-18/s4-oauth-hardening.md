# S4 — OAuth Hardening

> Closes: **P0-3** (OAuth account takeover by email), **P0-4** (state validation optional), **P0-5** (OAuth callback local `storeRefreshToken` skips KV), **P1-7** (OAuth session missing userAgent/ipAddress).

## Goal

Three discrete fixes to the OAuth flow in `apps/api/src/routes/auth/oauth.ts`:
1. **State is required** — reject callbacks with empty/missing `state`.
2. **Email-only match binds the OAuth identity** — when an existing user matches by email, the OAuth identity is linked (oauth_provider + oauth_id updated) so a future Google login with the same email does not silently re-link. If the existing user is already linked to a different provider, reject with a clear error.
3. **Unified `storeRefreshToken`** — replace the local one in `oauth.ts` with the one in `lib/sessions.ts` (which writes to KV). Pass userAgent + ipAddress.

## File Structure

```
apps/api/src/routes/auth/
├── oauth.ts                       # EDIT
└── __tests__/
    └── oauth.test.ts              # EDIT — add 3 new tests
apps/api/src/lib/
└── sessions.ts                    # UNCHANGED
```

---

## Task 1: State is mandatory

**Files:**
- Edit: `apps/api/src/routes/auth/oauth.ts`

- [ ] **Step 1: Replace the optional state check**

Lines 165-172 currently:

```typescript
if (state) {
  const storedState = await c.env.SESSIONS.get(`oauth_state:${state}`);
  if (!storedState) {
    throw new AppError('INVALID_STATE', 'Invalid or expired state parameter', 400);
  }
  await c.env.SESSIONS.delete(`oauth_state:${state}`);
}
```

Replace with:

```typescript
if (!state) {
  throw new AppError('INVALID_STATE', 'Missing state parameter', 400);
}
const storedState = await c.env.SESSIONS.get(`oauth_state:${state}`);
if (!storedState) {
  throw new AppError('INVALID_STATE', 'Invalid or expired state parameter', 400);
}
await c.env.SESSIONS.delete(`oauth_state:${state}`);
```

## Task 2: Account-takeover fix

**Files:**
- Edit: `apps/api/src/routes/auth/oauth.ts`

- [ ] **Step 1: Refactor the email-match branch**

The current branch (lines 234-270) silently signs in as the email-matched user. The new behavior is to bind the OAuth identity to the user (or fail if the user is already bound to a different provider).

After the `existingByOAuth` block (which is correct as-is), refactor the email-match block:

```typescript
const existingByEmail = (await c.env.DB.prepare(
  'SELECT id, email, name, oauth_provider, oauth_id FROM users WHERE email = ?',
)
  .bind(userInfo.email.toLowerCase())
  .first()) as (DbUser & { oauth_provider: string | null; oauth_id: string | null }) | null;

if (existingByEmail) {
  // If already linked to a different provider, reject — user must explicitly unlink first.
  if (existingByEmail.oauth_provider && existingByEmail.oauth_provider !== provider) {
    throw new AppError(
      'OAUTH_ALREADY_LINKED',
      `This email is linked to ${existingByEmail.oauth_provider}. Sign in with that provider or contact support.`,
      409,
    );
  }

  // Bind OAuth identity to existing user (or update provider if previously set to same).
  if (!existingByEmail.oauth_provider) {
    await c.env.DB.prepare(
      `UPDATE users SET oauth_provider = ?, oauth_id = ?, updated_at = ?
       WHERE id = ? AND oauth_provider IS NULL`,
    )
      .bind(provider, userInfo.id, new Date().toISOString(), existingByEmail.id)
      .run();
  }

  // ... existing token signing + return stays the same
}
```

- [ ] **Step 2: Switch the local `storeRefreshToken` to the lib one**

Delete the local `storeRefreshToken` at lines 132-150. Import the canonical one:

```typescript
import { storeRefreshToken as persistSession } from '../../lib/sessions';
```

Replace each call (lines 212, 250, 293) with:

```typescript
await persistSession(c, {
  userId: existingByOAuth.id,           // or existingByEmail.id / userId below
  refreshToken: jwtRefreshToken,
  sessionId,                           // declared above
  userAgent: requestInfo.userAgent,
  ipAddress: requestInfo.ipAddress,
});
```

This requires hoisting `sessionId` to before the `persistSession` call. Update each branch.

## Task 3: Test all three changes

**Files:**
- Edit: `apps/api/src/routes/auth/__tests__/oauth.test.ts`

- [ ] **Step 1: Test state required**

```typescript
it('rejects callback without state', async () => {
  const res = await app.request('/auth/oauth/callback/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'x' }),
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('INVALID_STATE');
});
```

- [ ] **Step 2: Test account-takeover rejection**

Add a fixture: user exists with email `t@x`, `oauth_provider = 'github'`. The callback uses `google`. Assert: 409 `OAUTH_ALREADY_LINKED`, no session issued.

- [ ] **Step 3: Test KV session is written for OAuth**

Mock `c.env.SESSIONS.put`; assert it is called with `session:<id>` and `'active'`.

## Verification

```bash
./init.sh quick
```

## Acceptance

- [ ] OAuth callback requires `state` (no `if (state)` guard).
- [ ] Email-matched user is bound to the new provider; pre-bound user to a different provider is rejected with 409.
- [ ] OAuth sessions end up in KV (logout will actually invalidate them).
- [ ] `userAgent` + `ipAddress` recorded in `sessions` row for OAuth logins.

## Rollback

```bash
git revert <s4-commit>
```

## Closes

- **P0-3** — OAuth account takeover via email.
- **P0-4** — optional state validation.
- **P0-5** — OAuth sessions not in KV.
- **P1-7** — OAuth session missing userAgent/ipAddress.

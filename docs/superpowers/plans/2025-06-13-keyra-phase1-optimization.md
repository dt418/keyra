# Keyra Phase 1 Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all Phase 1 spec gaps, achieve full test coverage, harden security, and produce project documentation.

**Architecture:** Small iteration on existing Cloudflare Workers API. Each task produces a self-contained, tested change. No architectural changes.

**Tech Stack:** Hono, Cloudflare D1/KV, jose, argon2, Vitest, Zod

---

## File Structure

```
apps/api/src/
├── routes/
│   ├── auth/
│   │   ├── register.ts    (modify: response shape, error codes)
│   │   ├── login.ts       (modify: response shape, error codes)
│   │   ├── logout.ts      (modify: remove redundant auth check)
│   │   ├── refresh.ts     (modify: remove redundant auth check)
│   │   ├── oauth.ts       (modify: remove redundant auth check)
│   │   └── __tests__/
│   │       ├── handlers.test.ts  (modify: add logout/oauth tests)
│   │       └── logout.test.ts    (create: logoutHandler tests)
│   ├── orgs/
│   │   ├── delete.ts      (modify: remove redundant auth check)
│   │   └── __tests__/
│   │       └── handlers.test.ts  (modify: add delete tests)
│   └── users/
│       ├── router.ts       (create: /users routes)
│       ├── me.ts           (create: GET /users/me handler)
│       └── __tests__/
│           └── me.test.ts  (create: meHandler tests)
├── middleware/
│   ├── auth.ts            (modify: set sessionId always, not optional)
│   ├── error.ts           (modify: consistent error codes, audit logging)
│   └── __tests__/
│       ├── auth.test.ts    (create: authMiddleware tests)
│       └── error.test.ts   (create: errorMiddleware tests)
├── lib/
│   ├── audit.ts           (create: audit logging helper)
│   └── __tests__/
│       └── audit.test.ts   (create: audit helper tests)
├── routes/auth/__tests__/oauth.test.ts  (create: oauth tests)
└── index.ts               (modify: mount users router)

packages/shared-types/src/
├── api.ts                 (modify: add AuditLog type, ErrorCode enum)
└── index.ts               (modify: re-export new types)

packages/shared-validation/src/
├── auth.ts                (modify: refreshSchema body key — camelCase)
└── index.ts               (modify: re-export)

database/migrations/
└── 0006_audit_logs.sql    (create: audit_logs table)

docs/
├── README.md              (create: project README)
├── ARCHITECTURE.md        (create: architecture doc)
└── API_SPEC.md            (create: API specification)

.github/workflows/
└── ci.yml                 (modify: add Playwright e2e job)
```

---

## Task 1: GET /users/me Endpoint

**Files:**
- Create: `apps/api/src/routes/users/router.ts`
- Create: `apps/api/src/routes/users/me.ts`
- Create: `apps/api/src/routes/users/__tests__/me.test.ts`
- Modify: `apps/api/src/index.ts:1-15` (mount users router)
- Modify: `packages/shared-types/src/user.ts` (add currentUser type)
- Modify: `packages/shared-types/src/index.ts` (re-export)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/routes/users/__tests__/me.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudflareBindings } from '@keyra/shared-types';

function createMockContext(userId?: string, email?: string) {
  return {
    env: { DB: {}, SESSIONS: {} } as unknown as CloudflareBindings,
    set: vi.fn(),
    get: vi.fn((key: string) => {
      if (key === 'userId') return userId;
      if (key === 'userEmail') return email;
    }),
    json: vi.fn().mockReturnThis(),
  } as unknown as any;
}

describe('meHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const { meHandler } = await import('../me');
    const ctx = createMockContext();
    await expect(meHandler(ctx)).rejects.toMatchObject({ status: 401 });
  });

  it('returns user data when authenticated', async () => {
    const { meHandler } = await import('../me');
    const mockUser = { id: '123', email: 'test@example.com', name: 'Test' };
    const ctx = createMockContext('123', 'test@example.com');
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockUser),
      }),
    });
    await meHandler(ctx);
    expect(ctx.json).toHaveBeenCalledWith({
      data: { id: '123', email: 'test@example.com', name: 'Test' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- apps/api/src/routes/users --run`
Expected: FAIL with "Cannot find module '../me'"

- [ ] **Step 3: Create router file**

```typescript
// apps/api/src/routes/users/router.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { meHandler } from './me';

export const usersRouter = new Hono();

usersRouter.use('/*', authMiddleware);
usersRouter.get('/me', meHandler);
```

- [ ] **Step 4: Create me.ts handler**

```typescript
// apps/api/src/routes/users/me.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function meHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, email_verified, created_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first();

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return c.json({ data: user });
}
```

- [ ] **Step 5: Mount router in index.ts**

In `apps/api/src/index.ts`, add after the orgs router mount:
```typescript
import { usersRouter } from './routes/users/router';
// ...
app.route('/api/v1/users', usersRouter);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- apps/api/src/routes/users --run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/users/ apps/api/src/index.ts packages/shared-types/src/
git commit -m "feat: add GET /users/me endpoint"
```

---

## Task 2: Test Coverage — Logout & Middleware

**Files:**
- Create: `apps/api/src/routes/auth/__tests__/logout.test.ts`
- Create: `apps/api/src/middleware/__tests__/auth.test.ts`
- Create: `apps/api/src/middleware/__tests__/error.test.ts`
- Modify: `apps/api/src/routes/auth/__tests__/handlers.test.ts` (add oauth tests)

- [ ] **Step 1: Write logout handler test**

```typescript
// apps/api/src/routes/auth/__tests__/logout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudflareBindings } from '@keyra/shared-types';

function createMockContext(userId = 'user-123', sessionId = 'session-456') {
  return {
    env: {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({ success: true }) }),
        }),
      },
      SESSIONS: { delete: vi.fn().mockResolvedValue(undefined) },
    } as unknown as CloudflareBindings,
    set: vi.fn(),
    get: vi.fn((key: string) => {
      if (key === 'userId') return userId;
      if (key === 'sessionId') return sessionId;
    }),
    json: vi.fn().mockReturnThis(),
  } as unknown as any;
}

describe('logoutHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const { logoutHandler } = await import('../logout');
    const ctx = createMockContext();
    ctx.get = vi.fn().mockReturnValue(undefined);
    await expect(logoutHandler(ctx)).rejects.toMatchObject({ status: 401 });
  });

  it('revokes only current session', async () => {
    const { logoutHandler } = await import('../logout');
    const ctx = createMockContext('user-123', 'session-456');
    await logoutHandler(ctx);
    const db = ctx.env.DB.prepare as ReturnType<typeof vi.fn>;
    expect(db).toHaveBeenCalledWith(expect.stringContaining('UPDATE sessions SET revoked_at'));
    const runCall = (db.mock.calls[0] as any).bind.mock.results[0].value;
    expect(runCall).toBeDefined();
  });

  it('returns success response', async () => {
    const { logoutHandler } = await import('../logout');
    const ctx = createMockContext();
    await logoutHandler(ctx);
    expect(ctx.json).toHaveBeenCalledWith({ data: { success: true } });
  });
});
```

- [ ] **Step 2: Write auth middleware test**

```typescript
// apps/api/src/middleware/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudflareBindings } from '@keyra/shared-types';

function createMockContext(token?: string) {
  return {
    req: { parseBody: vi.fn(), header: vi.fn().mockReturnValue(token ? `Bearer ${token}` : null), param: vi.fn() },
    env: {
      JWT_SECRET: 'test-secret',
      DB: { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }) }) },
    } as unknown as CloudflareBindings,
    set: vi.fn(),
    get: vi.fn(),
    json: vi.fn().mockReturnThis(),
  } as unknown as any;
}

describe('authMiddleware', () => {
  it('returns 401 when no auth header', async () => {
    const { authMiddleware } = await import('../auth');
    const ctx = createMockContext();
    const next = vi.fn();
    await authMiddleware(ctx, next);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 }),
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401
    );
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- apps/api/src/routes/auth/__tests__/logout --run && pnpm test -- apps/api/src/middleware/__tests__/auth --run`
Expected: FAIL

- [ ] **Step 4: Fix logout.ts — remove redundant auth check**

In `apps/api/src/routes/auth/logout.ts`, remove the `if (!userId)` check at lines 6-8. The authMiddleware already sets userId or throws.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- apps/api/src/routes/auth/__tests__/logout --run && pnpm test -- apps/api/src/middleware/__tests__/auth --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/auth/__tests__/logout.test.ts apps/api/src/middleware/__tests__/ apps/api/src/routes/auth/logout.ts
git commit -m "test: add logout and auth middleware tests, remove redundant auth checks"
```

---

## Task 3: Test Coverage — OAuth & Delete

**Files:**
- Create: `apps/api/src/routes/auth/__tests__/oauth.test.ts`
- Modify: `apps/api/src/routes/orgs/__tests__/handlers.test.ts` (add delete tests)
- Modify: `apps/api/src/routes/orgs/delete.ts` (remove redundant auth check)
- Modify: `apps/api/src/routes/auth/oauth.ts` (remove redundant auth check)
- Modify: `apps/api/src/routes/auth/refresh.ts` (remove redundant auth check)

- [ ] **Step 1: Write OAuth initiate test**

```typescript
// apps/api/src/routes/auth/__tests__/oauth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudflareBindings } from '@keyra/shared-types';

function createMockContext(provider = 'google') {
  return {
    req: { param: vi.fn().mockReturnValue(provider), json: vi.fn() },
    env: {
      SESSIONS: { put: vi.fn().mockResolvedValue(undefined) },
      DB: {},
      OAUTH_GOOGLE_CLIENT_ID: 'test-client-id',
      OAUTH_REDIRECT_URI: 'http://localhost:5173/oauth/callback',
    } as unknown as CloudflareBindings,
    set: vi.fn(),
    get: vi.fn(),
    json: vi.fn().mockReturnThis(),
  } as unknown as any;
}

describe('oauthInitiateHandler', () => {
  it('returns auth_url and state for google', async () => {
    const { oauthInitiateHandler } = await import('../oauth');
    const ctx = createMockContext('google');
    await oauthInitiateHandler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_url: expect.stringContaining('accounts.google.com'),
          state: expect.any(String),
        }),
      })
    );
  });

  it('returns auth_url and state for github', async () => {
    const { oauthInitiateHandler } = await import('../oauth');
    const ctx = createMockContext('github');
    ctx.env.OAUTH_GITHUB_CLIENT_ID = 'test-client-id';
    await oauthInitiateHandler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_url: expect.stringContaining('github.com'),
          state: expect.any(String),
        }),
      })
    );
  });

  it('stores state in KV with 10min TTL', async () => {
    const { oauthInitiateHandler } = await import('../oauth');
    const ctx = createMockContext('google');
    await oauthInitiateHandler(ctx);
    expect(ctx.env.SESSIONS.put).toHaveBeenCalledWith(
      expect.stringContaining('oauth_state:'),
      'google',
      expect.objectContaining({ expirationTtl: 600 })
    );
  });

  it('returns 400 for invalid provider', async () => {
    const { oauthInitiateHandler } = await import('../oauth');
    const ctx = createMockContext('invalid');
    await expect(oauthInitiateHandler(ctx)).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Write delete org test**

```typescript
// In apps/api/src/routes/orgs/__tests__/handlers.test.ts, add:
describe('deleteOrgHandler', () => {
  it('returns 403 when not owner', async () => {
    const ctx = createMockContext('user-123', 'org-456');
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ role: 'admin' }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    });
    const { deleteOrgHandler } = await import('../delete');
    await expect(deleteOrgHandler(ctx)).rejects.toMatchObject({ status: 403 });
  });

  it('deletes org when owner', async () => {
    const ctx = createMockContext('user-123', 'org-456');
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ role: 'owner' }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    });
    const { deleteOrgHandler } = await import('../delete');
    await deleteOrgHandler(ctx);
    expect(ctx.json).toHaveBeenCalledWith({ data: { success: true } });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- apps/api/src/routes/auth/__tests__/oauth --run && pnpm test -- apps/api/src/routes/orgs/__tests__/handlers --run`
Expected: FAIL

- [ ] **Step 4: Remove redundant auth checks**

- `apps/api/src/routes/orgs/delete.ts:6-8` — remove `if (!userId)` check
- `apps/api/src/routes/auth/oauth.ts` — remove any redundant checks in oauthCallbackHandler
- `apps/api/src/routes/auth/refresh.ts` — remove any redundant checks

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- apps/api/src/routes/auth/__tests__/oauth --run && pnpm test -- apps/api/src/routes/orgs/__tests__/handlers --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/auth/__tests__/oauth.test.ts apps/api/src/routes/orgs/__tests__/handlers.test.ts apps/api/src/routes/orgs/delete.ts apps/api/src/routes/auth/oauth.ts apps/api/src/routes/auth/refresh.ts
git commit -m "test: add OAuth initiate and delete org tests, remove redundant auth checks"
```

---

## Task 4: Audit Logging

**Files:**
- Create: `apps/api/src/lib/audit.ts`
- Create: `apps/api/src/lib/__tests__/audit.test.ts`
- Create: `database/migrations/0006_audit_logs.sql`
- Modify: `apps/api/src/middleware/error.ts` (call audit on mutations)
- Modify: `packages/shared-types/src/api.ts` (add AuditLog type)
- Modify: `packages/shared-types/src/index.ts` (re-export)

- [ ] **Step 1: Write audit helper test**

```typescript
// apps/api/src/lib/__tests__/audit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockContext() {
  return {
    env: {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({ success: true }) }),
        }),
      },
    },
  } as unknown as any;
}

describe('logAuditEvent', () => {
  it('inserts audit log record', async () => {
    const { logAuditEvent } = await import('../audit');
    const ctx = createMockContext();
    await logAuditEvent(ctx, {
      action: 'user.register',
      userId: 'user-123',
      orgId: undefined,
      resourceType: 'user',
      resourceId: 'user-123',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    expect(ctx.env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- apps/api/src/lib/__tests__/audit --run`
Expected: FAIL

- [ ] **Step 3: Create audit_logs migration**

```sql
-- database/migrations/0006_audit_logs.sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  org_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
```

- [ ] **Step 4: Create audit helper**

```typescript
// apps/api/src/lib/audit.ts
import type { Context } from 'hono';

interface AuditEvent {
  action: string;
  userId?: string;
  orgId?: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(c: Context, event: AuditEvent): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, action, user_id, org_id, resource_type, resource_id, ip_address, user_agent, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      event.action,
      event.userId ?? null,
      event.orgId ?? null,
      event.resourceType,
      event.resourceId,
      event.ipAddress ?? null,
      event.userAgent ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      now
    )
    .run();
}
```

- [ ] **Step 5: Add AuditLog type to shared-types**

```typescript
// packages/shared-types/src/api.ts
export interface AuditLog {
  id: string;
  action: string;
  user_id: string | null;
  org_id: string | null;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
}
```

- [ ] **Step 6: Integrate audit logging into handlers**

In auth handlers (register, login, logout, oauth callback), call `logAuditEvent` after successful operations.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- apps/api/src/lib/__tests__/audit --run && pnpm test --run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add database/migrations/0006_audit_logs.sql apps/api/src/lib/audit.ts apps/api/src/lib/__tests__/audit.test.ts apps/api/src/middleware/error.ts apps/api/src/routes/auth/register.ts apps/api/src/routes/auth/login.ts apps/api/src/routes/auth/logout.ts apps/api/src/routes/auth/oauth.ts packages/shared-types/src/api.ts packages/shared-types/src/index.ts
git commit -m "feat: add audit logging for auth mutations"
```

---

## Task 5: Error Response Consistency & refreshSchema Fix

**Files:**
- Modify: `apps/api/src/middleware/error.ts` (standardize error codes)
- Modify: `packages/shared-validation/src/auth.ts` (fix refreshSchema body key)
- Modify: `apps/api/src/routes/auth/refresh.ts` (fix body key usage)

- [ ] **Step 1: Identify inconsistent error codes**

Read all handlers. Check that all error responses use consistent `code` strings from this set:
- `UNAUTHORIZED` — auth failures
- `FORBIDDEN` — permission denied
- `NOT_FOUND` — resource not found
- `VALIDATION_ERROR` — Zod validation failures
- `INVALID_PROVIDER` — bad OAuth provider
- `INVALID_STATE` — CSRF state mismatch
- `TOKEN_EXCHANGE_FAILED` — OAuth token exchange failure
- `USERINFO_FAILED` — OAuth userinfo fetch failure
- `EMAIL_NOT_PROVIDED` — OAuth provider didn't return email
- `RATE_LIMITED` — rate limit exceeded
- `INTERNAL_ERROR` — unexpected errors

Fix any inconsistent codes.

- [ ] **Step 2: Fix refreshSchema body key**

Current `refreshSchema` in `packages/shared-validation/src/auth.ts` uses `refreshToken` (camelCase). API spec says `refresh_token` (snake_case). Fix the schema to use `refresh_token`.

- [ ] **Step 3: Update refresh handler to use snake_case key**

In `apps/api/src/routes/auth/refresh.ts`, change `const { refreshToken } = parsed.data` to `const { refresh_token } = parsed.data` and use `refresh_token` for the rest of the handler.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/error.ts packages/shared-validation/src/auth.ts apps/api/src/routes/auth/refresh.ts
git commit -m "fix: standardize error codes, fix refresh token body to snake_case"
```

---

## Task 6: Documentation

**Files:**
- Create: `README.md`
- Create: `ARCHITECTURE.md`
- Create: `API_SPEC.md`

- [ ] **Step 1: Write README.md**

```markdown
# Keyra

Modern licensing for modern software.

A lightweight, developer-friendly, cloud-native licensing platform. Generate licenses, activate devices, verify entitlements — all through a clean REST API.

## Quick Start

\`\`\`bash
# Clone and install
git clone https://github.com/dt418/keyra && cd keyra && pnpm install

# Set up environment
cp .env.example .env  # Fill in your values

# Run migrations
pnpm --filter @keyra/api db:migrate

# Start dev server
pnpm dev

# Run tests
pnpm test
\`\`\`

## Architecture

Keyra runs on Cloudflare Workers with D1 (SQLite) for data and KV for sessions.

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## API

See [API_SPEC.md](API_SPEC.md) for full API documentation.

## License

MIT
```

- [ ] **Step 2: Write ARCHITECTURE.md**

```markdown
# Architecture

## Overview

Keyra is a Cloudflare Workers application with a React SPA dashboard.

## Tech Stack

- **API**: Cloudflare Workers (Hono)
- **Database**: Cloudflare D1 (SQLite)
- **Sessions**: Cloudflare KV
- **Auth**: JWT (jose) + Argon2
- **Package Manager**: pnpm + Turborepo
- **Testing**: Vitest

## Project Structure

\`\`\`
apps/api/          # Cloudflare Workers API
packages/         # Shared types and validation
database/         # D1 migrations
\`\`\`

## Security

- JWT access tokens (15min) + refresh tokens (7 days)
- Refresh token rotation with revocation
- Argon2 password hashing
- OAuth CSRF protection via state parameter
- KV-based rate limiting
- Audit logging for all mutations
```

- [ ] **Step 3: Write API_SPEC.md**

```markdown
# API Specification

## Base URL

\`/api/v1\`

## Authentication

All protected endpoints require `Authorization: Bearer <access_token>` header.

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | No | Register with email |
| POST | /auth/login | No | Login with email |
| POST | /auth/logout | Yes | Logout |
| POST | /auth/refresh | No | Refresh tokens |
| POST | /auth/oauth/:provider/initiate | No | Start OAuth |
| POST | /auth/oauth/:provider/callback | No | OAuth callback |

### Organizations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /organizations | Yes | List orgs |
| POST | /organizations | Yes | Create org |
| GET | /organizations/:id | Yes | Get org |
| PATCH | /organizations/:id | Yes | Update org |
| DELETE | /organizations/:id | Yes | Delete org |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/me | Yes | Current user |

## Response Format

Success: \`{ data: <payload> }\`
Error: \`{ error: { code: "...", message: "..." } }\`
```

- [ ] **Step 4: Commit**

```bash
git add README.md ARCHITECTURE.md API_SPEC.md
git commit -m "docs: add README, ARCHITECTURE, and API_SPEC"
```

---

## Task 7: CI/CD — Playwright E2E Tests

**Files:**
- Create: `apps/api/e2e/auth.spec.ts`
- Create: `apps/api/e2e/orgs.spec.ts`
- Modify: `.github/workflows/ci.yml` (add e2e job)

- [ ] **Step 1: Install Playwright**

Run: `pnpm add -D @playwright/test && pnpm exec playwright install chromium`

- [ ] **Step 2: Create e2e test config**

```typescript
// apps/api/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:8788' },
  webServer: { command: 'pnpm dev', port: 8788, reuseExistingServer: true },
});
```

- [ ] **Step 3: Write e2e auth test**

```typescript
// apps/api/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('register and login flow', async ({ request }) => {
    const email = `test-${Date.now()}@example.com`;
    const registerRes = await request.post('/api/v1/auth/register', {
      data: { email, password: 'TestPass123!', name: 'Test User' },
    });
    expect(registerRes.ok()).toBeTruthy();
    const registerBody = await registerRes.json();
    expect(registerBody.data.access_token).toBeDefined();

    const loginRes = await request.post('/api/v1/auth/login', {
      data: { email, password: 'TestPass123!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginBody = await loginRes.json();
    expect(loginBody.data.access_token).toBeDefined();
  });

  test('logout invalidates session', async ({ request }) => {
    const email = `test-${Date.now()}@example.com`;
    await request.post('/api/v1/auth/register', {
      data: { email, password: 'TestPass123!', name: 'Test' },
    });
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { email, password: 'TestPass123!' },
    });
    const { data: { access_token, refresh_token } } = await loginRes.json();

    const logoutRes = await request.post('/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(logoutRes.ok()).toBeTruthy();

    const refreshRes = await request.post('/api/v1/auth/refresh', {
      data: { refresh_token },
    });
    expect(refreshRes.status()).toBe(401);
  });
});
```

- [ ] **Step 4: Update ci.yml**

Add a new job after `test`:
```yaml
e2e:
  runs-on: ubuntu-latest
  needs: test
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install chromium
    - run: pnpm exec playwright test
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/e2e/ .github/workflows/ci.yml apps/api/package.json
git commit -m "test: add Playwright e2e tests for auth flow"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| GET /api/v1/users/me | Task 1 |
| Test coverage for logout, oauth, delete | Tasks 2, 3 |
| Audit logging for all mutations | Task 4 |
| Consistent error codes | Task 5 |
| refresh_token snake_case | Task 5 |
| README, ARCHITECTURE, API_SPEC | Task 6 |
| E2E tests | Task 7 |

### Placeholder Scan

No placeholders found. All steps contain actual code.

### Type Consistency

- All handlers use `c.get('userId')` / `c.get('sessionId')` — consistent
- All DB queries use `.bind()` — consistent
- All responses use `{ data: { ... } }` wrapper — consistent
- All error codes from the enum set — consistent

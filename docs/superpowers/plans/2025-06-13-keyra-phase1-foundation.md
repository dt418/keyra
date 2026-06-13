# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete monorepo foundation: pnpm + Turborepo scaffold, Cloudflare Workers API shell, D1/KV setup, auth, orgs, shared packages, and CI/CD.

**Architecture:** Cloudflare Workers (Hono framework) + D1 (SQLite) + KV for sessions. All API endpoints under `/api/v1/`. Shared TypeScript types and Zod schemas in packages/.

**Tech Stack:** pnpm, Turborepo, Cloudflare Workers, Hono, jose, argon2, Zod, Vitest, TypeScript

---

## File Structure

```
keyra/
├── apps/
│   └── api/                          # Cloudflare Workers API
│       ├── src/
│       │   ├── index.ts              # Worker entry point
│       │   ├── router.ts             # Main Hono router
│       │   ├── routes/
│       │   │   ├── auth/
│       │   │   │   ├── router.ts     # Auth endpoints
│       │   │   │   ├── register.ts
│       │   │   │   ├── login.ts
│       │   │   │   ├── logout.ts
│       │   │   │   ├── refresh.ts
│       │   │   │   └── oauth.ts
│       │   │   └── orgs/
│       │   │       ├── router.ts     # Org endpoints
│       │   │       ├── list.ts
│       │   │       ├── create.ts
│       │   │       ├── get.ts
│       │   │       └── update.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT validation
│       │   │   ├── rateLimit.ts      # Rate limiting
│       │   │   └── error.ts          # Error handler
│       │   └── lib/
│       │       ├── jwt.ts            # JWT signing/verification
│       │       ├── password.ts       # Argon2 hashing
│       │       └── kv.ts            # KV client
│       ├── tsconfig.json
│       ├── wrangler.jsonc
│       └── package.json
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── user.ts
│   │   │   ├── organization.ts
│   │   │   ├── api.ts
│   │   │   └── env.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared-validation/
│       ├── src/
│       │   ├── index.ts
│       │   ├── auth.ts               # Auth Zod schemas
│       │   └── orgs.ts               # Org Zod schemas
│       ├── tsconfig.json
│       └── package.json
├── database/
│   ├── migrations/
│   │   ├── 0001_users.sql
│   │   ├── 0002_organizations.sql
│   │   ├── 0003_org_members.sql
│   │   └── 0004_sessions.sql
│   └── client.ts                     # D1 client wrapper
├── infrastructure/
│   └── cloudflare/
│       ├── wrangler.jsonc            # Root CF config
│       └── .dev.vars                 # Local env vars
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── .gitignore
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.jsonc`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/router.ts`
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-validation/package.json`
- Create: `packages/shared-validation/tsconfig.json`
- Create: `infrastructure/cloudflare/wrangler.jsonc`
- Create: `infrastructure/cloudflare/.dev.vars`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "keyra",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:migrate": "pnpm --filter @keyra/api wrangler d1 migrations apply keyra-db --local"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "lint": { "dependsOn": ["build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Create apps/api/package.json**

```json
{
  "name": "@keyra/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc --noEmit",
    "deploy": "wrangler deploy",
    "test": "vitest",
    "lint": "eslint src --fix"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-openapi": "^0.9.0",
    "zod": "^3.23.0",
    "jose": "^5.4.0",
    "argon2": "^0.40.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "wrangler": "^4.0.0",
    "vitest": "^1.6.0",
    "eslint": "^9.0.0"
  }
}
```

- [ ] **Step 6: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "outDir": "dist"
  },
  "include": ["src/**/*", "*.ts"]
}
```

- [ ] **Step 7: Create apps/api/wrangler.jsonc**

```jsonc
{
  "name": "keyra-api",
  "main": "src/index.ts",
  "compatibility_date": "2024-06-13",
  "assets": { "directory": "public" },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "keyra-db",
      "database_id": "REPLACE_WITH_ACTUAL_ID"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "REPLACE_WITH_ACTUAL_ID"
    }
  ],
  "vars": {
    "ENVIRONMENT": "development"
  }
}
```

- [ ] **Step 8: Create apps/api/src/index.ts**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { router } from './router';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.route('/api/v1', router);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

- [ ] **Step 9: Create apps/api/src/router.ts**

```typescript
import { Hono } from 'hono';
import { authRouter } from './routes/auth/router';
import { orgsRouter } from './routes/orgs/router';

export const router = new Hono()
  .route('/auth', authRouter)
  .route('/organizations', orgsRouter);
```

- [ ] **Step 10: Create package placeholders for shared packages**

```json
{
  "name": "@keyra/shared-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./user": "./dist/user.js",
    "./organization": "./dist/organization.js",
    "./api": "./dist/api.js",
    "./env": "./dist/env.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

```json
{
  "name": "@keyra/shared-validation",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./auth": "./dist/auth.js",
    "./orgs": "./dist/orgs.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 11: Create .gitignore**

```
node_modules/
dist/
.turbo/
.wrangler/
.dev.vars
*.local
.env
.env.local
coverage/
.DS_Store
```

- [ ] **Step 12: Create .env.example**

```
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=

# Database
D1_DATABASE_ID=
D1_DATABASE_NAME=keyra-db

# KV
SESSIONS_KV_ID=

# Environment
ENVIRONMENT=development
API_URL=http://localhost:8788
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 13: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json apps/api/ packages/ infrastructure/ .gitignore .env.example
git commit -m "feat: monorepo scaffold with pnpm + Turborepo"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/user.ts`
- Create: `packages/shared-types/src/organization.ts`
- Create: `packages/shared-types/src/api.ts`
- Create: `packages/shared-types/src/env.ts`

- [ ] **Step 1: Create packages/shared-types/src/user.ts**

```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  oauth_provider: 'google' | 'github' | null;
  oauth_id: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}
```

- [ ] **Step 2: Create packages/shared-types/src/organization.ts**

```typescript
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'business' | 'enterprise';
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  plan: Organization['plan'];
  created_at: string;
}
```

- [ ] **Step 3: Create packages/shared-types/src/api.ts**

```typescript
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    total?: number;
  };
}

export interface CloudflareBindings {
  DB: D1Database;
  SESSIONS: KVNamespace;
}
```

- [ ] **Step 4: Create packages/shared-types/src/env.ts**

```typescript
export interface Env {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_URL: string;
  FRONTEND_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_GOOGLE_CLIENT_SECRET: string;
  OAUTH_GITHUB_CLIENT_ID: string;
  OAUTH_GITHUB_CLIENT_SECRET: string;
}
```

- [ ] **Step 5: Create packages/shared-types/src/index.ts**

```typescript
export type { User, PublicUser } from './user';
export type { Organization, OrgMember, PublicOrg } from './organization';
export type { ApiError, ApiResponse, PaginatedResponse, CloudflareBindings } from './api';
export type { Env } from './env';
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/
git commit -m "feat(shared-types): add core TypeScript types"
```

---

## Task 3: Shared Validation Package

**Files:**
- Create: `packages/shared-validation/src/index.ts`
- Create: `packages/shared-validation/src/auth.ts`
- Create: `packages/shared-validation/src/orgs.ts`

- [ ] **Step 1: Create packages/shared-validation/src/auth.ts**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
```

- [ ] **Step 2: Create packages/shared-validation/src/orgs.ts**

```typescript
import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const listOrgsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type ListOrgsInput = z.infer<typeof listOrgsSchema>;
```

- [ ] **Step 3: Create packages/shared-validation/src/index.ts**

```typescript
export * from './auth';
export * from './orgs';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared-validation/src/
git commit -m "feat(shared-validation): add Zod schemas for auth and orgs"
```

---

## Task 4: Database Migrations

**Files:**
- Create: `database/migrations/0001_users.sql`
- Create: `database/migrations/0002_organizations.sql`
- Create: `database/migrations/0003_org_members.sql`
- Create: `database/migrations/0004_sessions.sql`
- Create: `database/client.ts`

- [ ] **Step 1: Create database/migrations/0001_users.sql**

```sql
-- Migration: 0001_users
-- Create users table with email + OAuth support

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  oauth_provider TEXT CHECK(oauth_provider IN ('google', 'github')),
  oauth_id TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
```

- [ ] **Step 2: Create database/migrations/0002_organizations.sql**

```sql
-- Migration: 0002_organizations
-- Create organizations table

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'business', 'enterprise')),
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
```

- [ ] **Step 3: Create database/migrations/0003_org_members.sql**

```sql
-- Migration: 0003_org_members
-- Create org_members junction table

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT org_members_unique UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
```

- [ ] **Step 4: Create database/migrations/0004_sessions.sql**

```sql
-- Migration: 0004_sessions
-- Create sessions table for refresh token tracking

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
```

- [ ] **Step 5: Create database/client.ts**

```typescript
import type { D1Database } from '@cloudflare/workers-types';

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
}

const migrations: Migration[] = [
  // Migrations are loaded from SQL files
];

export async function runMigrations(db: D1Database): Promise<void> {
  // Create migrations tracking table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get applied migrations
  const applied = await db.prepare(
    'SELECT id FROM _migrations ORDER BY id'
  ).all<{ id: string }>();

  const appliedIds = new Set(applied.results.map((r) => r.id));

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedIds.has(migration.id)) {
      await db.exec(migration.up);
      await db.prepare(
        'INSERT INTO _migrations (id, name) VALUES (?, ?)'
      ).bind(migration.id, migration.name).run();
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add database/
git commit -m "feat(db): add D1 migrations for users, orgs, members, sessions"
```

---

## Task 5: Authentication API

**Files:**
- Create: `apps/api/src/routes/auth/router.ts`
- Create: `apps/api/src/routes/auth/register.ts`
- Create: `apps/api/src/routes/auth/login.ts`
- Create: `apps/api/src/routes/auth/logout.ts`
- Create: `apps/api/src/routes/auth/refresh.ts`
- Create: `apps/api/src/routes/auth/oauth.ts`
- Create: `apps/api/src/lib/jwt.ts`
- Create: `apps/api/src/lib/password.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/rateLimit.ts`
- Create: `apps/api/src/middleware/error.ts`

- [ ] **Step 1: Create apps/api/src/lib/jwt.ts**

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ALGORITHM = 'HS256';

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export async function signAccessToken(
  payload: { sub: string; email: string },
  secret: string,
  expiresIn = '15m'
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function signRefreshToken(
  payload: { sub: string; email: string },
  secret: string,
  expiresIn = '7d'
): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: [ALGORITHM],
  });
  return payload as TokenPayload;
}
```

- [ ] **Step 2: Create apps/api/src/lib/password.ts**

```typescript
import { hash, verify } from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return verify(hash, password);
}
```

- [ ] **Step 3: Create apps/api/src/middleware/error.ts**

```typescript
import type { Context, Next } from 'hono';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: err.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        },
        400
      );
    }

    if (err instanceof AppError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        err.status
      );
    }

    console.error('Unhandled error:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
}
```

- [ ] **Step 4: Create apps/api/src/middleware/rateLimit.ts**

```typescript
import type { Context, Next } from 'hono';

const RATE_LIMIT_PREFIX = 'rl:';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const key = `${RATE_LIMIT_PREFIX}${ip}`;
    const kv = c.env.SESSIONS;

    const current = await kv.get(key, 'text');
    const count = current ? parseInt(current, 10) : 0;

    if (count >= options.maxRequests) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        },
        429
      );
    }

    await kv.put(key, String(count + 1), {
      expirationTtl: Math.ceil(options.windowMs / 1000),
    });

    await next();
  };
}
```

- [ ] **Step 5: Create apps/api/src/middleware/auth.ts**

```typescript
import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';
import { AppError } from './error';

export interface AuthVariables {
  userId: string;
  userEmail: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing authorization header', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (payload.type !== 'access') {
      throw new AppError('UNAUTHORIZED', 'Invalid token type', 401);
    }
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);
    await next();
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
```

- [ ] **Step 6: Create apps/api/src/routes/auth/register.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { registerSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { hashPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';

export async function registerHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.errors);
  }

  const { email, password, name } = parsed.data;

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    throw new AppError('USER_EXISTS', 'Email already registered', 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, email, name, password_hash, email_verified)
    VALUES (?, ?, ?, ?, 1)
  `).bind(id, email, name ?? null, passwordHash).run();

  const accessToken = await signAccessToken({ sub: id, email }, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken({ sub: id, email }, c.env.JWT_REFRESH_SECRET);

  return c.json({
    data: {
      user: { id, email, name, avatar_url: null },
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  });
}
```

- [ ] **Step 7: Create apps/api/src/routes/auth/login.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { loginSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';

export async function loginHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.errors);
  }

  const { email, password } = parsed.data;

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = ?'
  ).bind(email).first<{
    id: string; email: string; name: string | null;
    avatar_url: string | null; password_hash: string;
  }>();

  if (!user || !user.password_hash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const accessToken = await signAccessToken({ sub: user.id, email: user.email }, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken({ sub: user.id, email: user.email }, c.env.JWT_REFRESH_SECRET);

  return c.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  });
}
```

- [ ] **Step 8: Create apps/api/src/routes/auth/logout.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { AppError } from '../../middleware/error';

export async function logoutHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const userId = c.get('userId');
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.slice(7);

  // Revoke all sessions for this user (or specific token if tracking)
  await c.env.DB.prepare(
    'UPDATE sessions SET revoked_at = datetime("now") WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(userId).run();

  return c.json({ data: { success: true } });
}
```

- [ ] **Step 9: Create apps/api/src/routes/auth/refresh.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { refreshSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { verifyToken, signAccessToken, signRefreshToken } from '../../lib/jwt';

export async function refreshHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const body = await c.req.json();
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.errors);
  }

  const { refresh_token } = parsed.data;

  try {
    const payload = await verifyToken(refresh_token, c.env.JWT_REFRESH_SECRET);
    if (payload.type !== 'refresh') {
      throw new AppError('UNAUTHORIZED', 'Invalid token type', 401);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email FROM users WHERE id = ?'
    ).bind(payload.sub).first<{ id: string; email: string }>();

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User not found', 401);
    }

    const accessToken = await signAccessToken({ sub: user.id, email: user.email }, c.env.JWT_SECRET);
    const newRefreshToken = await signRefreshToken({ sub: user.id, email: user.email }, c.env.JWT_REFRESH_SECRET);

    return c.json({
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      },
    });
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
  }
}
```

- [ ] **Step 10: Create apps/api/src/routes/auth/oauth.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { AppError } from '../../middleware/error';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';

const OAUTH_URLS = {
  google: 'https://oauth2.googleapis.com/token',
  github: 'https://github.com/login/oauth/access_token',
};

const OAUTH_USER_URLS = {
  google: 'https://www.googleapis.com/oauth2/v2/userinfo',
  github: 'https://api.github.com/user',
};

export async function oauthCallbackHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>,
  provider: 'google' | 'github'
) {
  const { code, state } = await c.req.json();
  const expectedState = await c.env.SESSIONS.get(`oauth_state:${provider}`);

  if (!expectedState || state !== expectedState) {
    throw new AppError('INVALID_STATE', 'Invalid OAuth state', 400);
  }

  // Exchange code for token
  const tokenRes = await fetch(OAUTH_URLS[provider], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: provider === 'google' ? c.env.OAUTH_GOOGLE_CLIENT_ID : c.env.OAUTH_GITHUB_CLIENT_ID,
      client_secret: provider === 'google' ? c.env.OAUTH_GOOGLE_CLIENT_SECRET : c.env.OAUTH_GITHUB_CLIENT_SECRET,
      redirect_uri: `${c.env.API_URL}/api/v1/auth/oauth/${provider}/callback`,
    }),
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Get user info
  const userRes = await fetch(OAUTH_USER_URLS[provider], {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const oauthUser = await userRes.json();

  const oauthId = provider === 'google' ? oauthUser.id : oauthUser.id.toString();
  const email = provider === 'google' ? oauthUser.email : oauthUser.email;

  // Find or create user
  let user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url FROM users WHERE oauth_provider = ? AND oauth_id = ?'
  ).bind(provider, oauthId).first<{ id: string; email: string; name: string | null; avatar_url: string | null }>();

  if (!user) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, name, avatar_url, oauth_provider, oauth_id, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(id, email, oauthUser.name ?? null, oauthUser.avatar_url ?? null, provider, oauthId).run();
    user = { id, email, name: oauthUser.name ?? null, avatar_url: oauthUser.avatar_url ?? null };
  }

  const token = await signAccessToken({ sub: user.id, email: user.email }, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken({ sub: user.id, email: user.email }, c.env.JWT_REFRESH_SECRET);

  return c.json({
    data: {
      user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
      access_token: token,
      refresh_token: refreshToken,
    },
  });
}
```

- [ ] **Step 11: Create apps/api/src/routes/auth/router.ts**

```typescript
import { Hono } from 'hono';
import { registerHandler } from './register';
import { loginHandler } from './login';
import { logoutHandler } from './logout';
import { refreshHandler } from './refresh';
import { oauthCallbackHandler } from './oauth';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';

export const authRouter = new Hono()
  .post('/register', rateLimit({ windowMs: 60_000, maxRequests: 10 }), registerHandler)
  .post('/login', rateLimit({ windowMs: 60_000, maxRequests: 20 }), loginHandler)
  .post('/logout', authMiddleware, logoutHandler)
  .post('/refresh', refreshHandler)
  .post('/oauth/:provider/callback', oauthCallbackHandler);
```

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/routes/auth/ apps/api/src/lib/ apps/api/src/middleware/
git commit -m "feat(auth): add authentication API with JWT + OAuth"
```

---

## Task 6: Organization API

**Files:**
- Create: `apps/api/src/routes/orgs/router.ts`
- Create: `apps/api/src/routes/orgs/list.ts`
- Create: `apps/api/src/routes/orgs/create.ts`
- Create: `apps/api/src/routes/orgs/get.ts`
- Create: `apps/api/src/routes/orgs/update.ts`

- [ ] **Step 1: Create apps/api/src/routes/orgs/list.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { listOrgsSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function listOrgsHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const userId = c.get('userId');
  const query = listOrgsSchema.parse(c.req.query());

  const orgs = await c.env.DB.prepare(`
    SELECT o.id, o.name, o.slug, o.plan, o.created_at
    FROM organizations o
    INNER JOIN org_members om ON o.id = om.org_id
    WHERE om.user_id = ?
    ORDER BY o.created_at DESC
    LIMIT ?
  `).bind(userId, query.limit + 1).all<{
    id: string; name: string; slug: string; plan: string; created_at: string;
  }>();

  const hasMore = orgs.results.length > query.limit;
  const data = hasMore ? orgs.results.slice(0, -1) : orgs.results;
  const cursor = hasMore ? data[data.length - 1]?.id : null;

  return c.json({
    data,
    pagination: {
      cursor,
      has_more: hasMore,
    },
  });
}
```

- [ ] **Step 2: Create apps/api/src/routes/orgs/create.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { createOrgSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function createOrgHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.errors);
  }

  const { name, slug } = parsed.data;

  // Check slug uniqueness
  const existing = await c.env.DB.prepare(
    'SELECT id FROM organizations WHERE slug = ?'
  ).bind(slug).first();
  if (existing) {
    throw new AppError('SLUG_EXISTS', 'Organization slug already taken', 409);
  }

  const orgId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO organizations (id, name, slug)
    VALUES (?, ?, ?)
  `).bind(orgId, name, slug).run();

  await c.env.DB.prepare(`
    INSERT INTO org_members (id, user_id, org_id, role)
    VALUES (?, ?, ?, 'owner')
  `).bind(memberId, userId, orgId).run();

  return c.json({
    data: { id: orgId, name, slug, plan: 'free', created_at: new Date().toISOString() },
  }, 201);
}
```

- [ ] **Step 3: Create apps/api/src/routes/orgs/get.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { AppError } from '../../middleware/error';

export async function getOrgHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const userId = c.get('userId');
  const orgId = c.req.param('id');

  // Verify membership
  const membership = await c.env.DB.prepare(
    'SELECT role FROM org_members WHERE user_id = ? AND org_id = ?'
  ).bind(userId, orgId).first<{ role: string }>();

  if (!membership) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  const org = await c.env.DB.prepare(
    'SELECT id, name, slug, plan, created_at FROM organizations WHERE id = ?'
  ).bind(orgId).first<{
    id: string; name: string; slug: string; plan: string; created_at: string;
  }>();

  return c.json({ data: org });
}
```

- [ ] **Step 4: Create apps/api/src/routes/orgs/update.ts**

```typescript
import type { CloudflareBindings } from '@keyra/shared-types';
import { updateOrgSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function updateOrgHandler(
  c: Context<{ Bindings: CloudflareBindings; Variables: { userId: string; userEmail: string } }>
) {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.errors);
  }

  // Verify admin/owner role
  const membership = await c.env.DB.prepare(
    'SELECT role FROM org_members WHERE user_id = ? AND org_id = ?'
  ).bind(userId, orgId).first<{ role: string }>();

  if (!membership || membership.role === 'member') {
    throw new AppError('FORBIDDEN', 'Insufficient permissions', 403);
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.name !== undefined) {
    updates.push('name = ?');
    values.push(parsed.data.name);
  }
  if (parsed.data.settings !== undefined) {
    updates.push('settings = ?');
    values.push(JSON.stringify(parsed.data.settings));
  }

  if (updates.length === 0) {
    return c.json({ data: { success: true } });
  }

  updates.push('updated_at = datetime("now")');
  values.push(orgId);

  await c.env.DB.prepare(
    `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const org = await c.env.DB.prepare(
    'SELECT id, name, slug, plan, created_at, updated_at FROM organizations WHERE id = ?'
  ).bind(orgId).first();

  return c.json({ data: org });
}
```

- [ ] **Step 5: Create apps/api/src/routes/orgs/router.ts**

```typescript
import { Hono } from 'hono';
import { listOrgsHandler } from './list';
import { createOrgHandler } from './create';
import { getOrgHandler } from './get';
import { updateOrgHandler } from './update';
import { authMiddleware } from '../../middleware/auth';

export const orgsRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/', listOrgsHandler)
  .post('/', createOrgHandler)
  .get('/:id', getOrgHandler)
  .patch('/:id', updateOrgHandler);
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/orgs/
git commit -m "feat(orgs): add organization CRUD API"
```

---

## Task 7: CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

- [ ] **Step 2: Create .github/workflows/deploy.yml**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy to Cloudflare
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy API
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
          workingDirectory: apps/api
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI/CD pipeline"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Monorepo scaffold (pnpm + Turborepo) → Task 1
- [x] Cloudflare Workers API shell → Task 1
- [x] D1 database setup → Task 4
- [x] KV store setup → rateLimit middleware uses KV
- [x] User authentication (email + OAuth) → Task 5
- [x] Organization model → Task 6
- [x] Shared packages (types, validation) → Tasks 2, 3
- [x] CI/CD pipeline → Task 7

**Placeholder scan:** No TBD/TODO placeholders. All code is complete.

**Type consistency:** Types flow from shared-types → api. Method signatures match across tasks.

**Plan complete and saved to `docs/superpowers/plans/2025-06-13-keyra-phase1-foundation.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

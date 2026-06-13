# Architecture

## Overview

Keyra is a cloud-native licensing platform deployed on Cloudflare Workers with D1 (SQLite) for persistence and KV for high-speed token storage.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Auth | JWT + bcrypt + OAuth |
| Monorepo | Turborepo + pnpm |
| Language | TypeScript |

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Cloudflare Workers                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │  Auth   │───▶│  Rate   │───▶│ Handler │              │
│  │Middleware│    │  Limit  │    │         │              │
│  └─────────┘    └─────────┘    └────┬────┘              │
│                                      │                     │
│                          ┌───────────┴───────────┐         │
│                          ▼                       ▼         │
│                    ┌─────────────┐         ┌─────────┐     │
│                    │     D1      │         │    KV    │    │
│                    │  (SQLite)  │         │ (Tokens) │    │
│                    └─────────────┘         └─────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
keyra/
├── apps/
│   └── api/                    # Cloudflare Workers API
│       └── src/
│           ├── index.ts         # Entry point
│           ├── router.ts        # Route aggregation
│           ├── middleware/     # Auth, rate limiting, error
│           │   ├── auth.ts
│           │   ├── error.ts
│           │   └── rateLimit.ts
│           ├── lib/            # Utilities
│           │   ├── jwt.ts      # JWT sign/verify
│           │   ├── password.ts # bcrypt hashing
│           │   └── audit.ts    # Audit logging
│           └── routes/
│               ├── auth/        # Auth endpoints
│               │   ├── register.ts
│               │   ├── login.ts
│               │   ├── logout.ts
│               │   ├── refresh.ts
│               │   └── oauth.ts
│               ├── orgs/       # Organization endpoints
│               │   ├── list.ts
│               │   ├── create.ts
│               │   ├── get.ts
│               │   ├── update.ts
│               │   └── delete.ts
│               └── users/      # User endpoints
│                   └── me.ts
├── packages/
│   ├── shared-types/          # TypeScript interfaces
│   │   ├── user.ts
│   │   ├── organization.ts
│   │   └── api.ts
│   └── shared-validation/     # Zod schemas
│       ├── auth.ts
│       └── orgs.ts
├── database/
│   ├── client.ts              # Migration runner
│   └── migrations/
│       ├── 0001_users.sql
│       ├── 0002_organizations.sql
│       ├── 0003_org_members.sql
│       ├── 0004_sessions.sql
│       ├── 0005_session_cleanup.sql
│       └── 0006_audit_logs.sql
└── docs/
    ├── ARCHITECTURE.md
    └── API_SPEC.md
```

## Security Features

### Authentication Flow

```
1. Register/Login → bcrypt hash password
2. Return JWT access token (15min) + refresh token (7 days)
3. Refresh token stored in KV with hash
4. Protected routes → validate JWT
5. Refresh → verify refresh token, revoke old, issue new
6. Logout → mark session revoked in DB
```

### Token Security

| Token | TTL | Storage | Secret |
|-------|-----|---------|--------|
| Access | 15 min | Memory only | JWT_SECRET |
| Refresh | 7 days | KV + DB hash | JWT_REFRESH_SECRET |

### Password Security

- **Algorithm:** bcrypt with cost factor 12
- **No plaintext storage**

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/auth/register` | 10 req/min |
| `/auth/login` | 20 req/min |
| `/auth/logout` | 10 req/min |
| `/auth/refresh` | 30 req/min |
| `/auth/oauth/*` | 20 req/min |

## Data Flow

```
Client Request
    │
    ▼
Rate Limit (KV)
    │
    ▼
Auth Middleware (JWT)
    │
    ▼
Input Validation (Zod)
    │
    ▼
Business Logic
    │
    ├──▶ D1 (SQLite) — persistent data
    │
    ├──▶ KV — tokens/caching
    │
    └──▶ Audit Log (D1)
    │
    ▼
Response Format
```

## Database Schema

### Users

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID primary key |
| email | TEXT | Unique, indexed |
| name | TEXT | Optional |
| password_hash | TEXT | bcrypt |
| oauth_provider | TEXT | google/github |
| oauth_id | TEXT | Provider user ID |
| avatar_url | TEXT | Profile image |
| email_verified | INTEGER | 0/1 |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### Organizations

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID primary key |
| name | TEXT | Organization name |
| slug | TEXT | Unique URL-safe identifier |
| plan | TEXT | free/pro/business/enterprise |
| settings | TEXT | JSON configuration |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### Sessions

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID primary key |
| user_id | TEXT | FK to users |
| refresh_token_hash | TEXT | bcrypt hash |
| user_agent | TEXT | Browser/client info |
| ip_address | TEXT | Client IP |
| expires_at | TEXT | Expiration timestamp |
| created_at | TEXT | ISO timestamp |
| revoked_at | TEXT | Revocation timestamp |

### Audit Logs

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID primary key |
| user_id | TEXT | Actor |
| action | TEXT | user.register, user.login, etc. |
| ip_address | TEXT | Client IP |
| user_agent | TEXT | Client info |
| metadata | TEXT | JSON context |
| created_at | TEXT | ISO timestamp |

## Response Format

```typescript
// Success
{ data: { ... } }

// Error
{ error: { code: string, message: string, details?: [...] } }
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Invalid/expired token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

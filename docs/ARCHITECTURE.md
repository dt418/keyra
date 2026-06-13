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
| Auth | JWT + Argon2 + OAuth |
| Monorepo | Turborepo + pnpm |
| Language | TypeScript |

## Project Structure

```
keyra/
├── apps/
│   └── api/                    # Cloudflare Workers API
│       └── src/
│           ├── index.ts        # Entry point
│           ├── router.ts       # Route aggregation
│           ├── middleware/     # Auth, rate limiting, error handling
│           └── routes/        # Auth, organizations, users
├── packages/
│   ├── shared-types/          # Shared TypeScript types
│   └── shared-validation/     # Zod validation schemas
├── database/
│   └── client.ts              # D1 client
└── docs/
    ├── ARCHITECTURE.md
    └── API_SPEC.md
```

## Security Features

### Authentication
- **JWT Access Tokens:** Short-lived (15 min default)
- **Refresh Tokens:** Longer-lived, stored in KV
- **Password Hashing:** Argon2id
- **OAuth:** GitHub, Google support

### API Protection
- **Rate Limiting:** Per-endpoint limits (10-20 req/min)
- **Auth Middleware:** JWT validation on protected routes
- **Input Validation:** Zod schemas on all inputs

### Response Format

```typescript
// Success
{ data: { ... } }

// Error
{ error: { code: string, message: string } }
```

## Data Flow

```
Client → Rate Limit → Auth Middleware → Handler → D1/KV → Response
```

## Database Schema

D1 manages:
- Users (email, password hash, OAuth links)
- Organizations (name, owner, settings)
- Audit logs (action, actor, timestamp)

KV manages:
- Refresh tokens (user → token mapping)
- Rate limit counters

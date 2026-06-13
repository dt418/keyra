# Keyra

Cloud-native licensing platform for software distribution with device activation, license management, and secure authentication.

## Features

- **Device Activation** — Secure device registration with UUID-based identification
- **License Management** — Flexible license types (trial, free, paid tiers)
- **Multi-tenant** — Organizations with role-based access control
- **Authentication** — JWT + Refresh tokens, OAuth (Google, GitHub)
- **Audit Logging** — Complete activity tracking

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Framework | Hono |
| Auth | JWT + bcrypt + OAuth |
| Monorepo | Turborepo + pnpm |
| Language | TypeScript |

## Project Structure

```
keyra/
├── apps/
│   └── api/                    # Cloudflare Workers API
│       └── src/
│           ├── middleware/     # Auth, rate limiting, error handling
│           └── routes/        # Auth, organizations, users
├── packages/
│   ├── shared-types/          # TypeScript types
│   └── shared-validation/     # Zod schemas
└── database/
    └── migrations/           # D1 schema migrations
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account

### Installation

```bash
# Clone and install
git clone https://github.com/dt418/keyra.git
cd keyra
pnpm install
```

### Local Development

```bash
# Start API dev server (wrangler dev)
pnpm --filter @keyra/api dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### Environment Setup

```bash
# Copy example env
cp apps/api/.dev.vars.example apps/api/.dev.vars

# Edit with your values:
# - JWT_SECRET (generate with: openssl rand -base64 64)
# - JWT_REFRESH_SECRET (generate with: openssl rand -base64 64)
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID
```

### Remote Database Setup

```bash
# Create D1 database
wrangler d1 create keyra-db --update-config

# Run migrations
wrangler d1 migrations apply keyra-db --remote

# Create KV namespace
wrangler kv namespace create sessions
```

## Deployment

### Deploy to Cloudflare

```bash
cd apps/api

# Set required secrets
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET

# Deploy
wrangler deploy
```

### CI/CD

GitHub Actions automatically deploy on push to `main` and `develop` branches.

Required secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

## API Documentation

See [docs/API_SPEC.md](docs/API_SPEC.md) for complete API reference.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design details.

## Packages

| Package | Description |
|---------|-------------|
| `apps/api` | Cloudflare Workers API |
| `packages/shared-types` | Shared TypeScript types |
| `packages/shared-validation` | Zod validation schemas |
| `database` | D1 schema and migrations |

## License

MIT

# Keyra

Cloud-native licensing platform built on Cloudflare Workers.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Workers
AUTH_SECRET=your-jwt-secret
REFRESH_SECRET=your-refresh-secret

# OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database
DATABASE_URL=...
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architecture details.

## API Reference

See [docs/API_SPEC.md](docs/API_SPEC.md) for complete API documentation.

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1
- **Cache:** Cloudflare KV
- **Framework:** Hono
- **Auth:** JWT + Argon2 + OAuth
- **Monorepo:** Turborepo + pnpm

## Packages

| Package | Description |
|---------|-------------|
| `apps/api` | Cloudflare Workers API |
| `packages/shared-types` | Shared TypeScript types |
| `packages/shared-validation` | Zod validation schemas |
| `database` | D1 schema and migrations |

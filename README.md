# Keyra

Cloud-native licensing platform for software distribution with device activation, license management, and secure authentication.

## Features

- **Device Activation** — Secure device registration with UUID-based identification
- **License Management** — Flexible license types (trial, free, paid tiers)
- **Multi-tenant** — Organizations with role-based access control
- **Authentication** — JWT + Refresh tokens, OAuth (Google, GitHub)
- **Audit Logging** — Complete activity tracking
- **Admin Dashboard** — React 18 SPA with TanStack Table, command palette, dark mode

## Tech Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Runtime  | Cloudflare Workers                               |
| Database | Cloudflare D1 (SQLite)                           |
| Cache    | Cloudflare KV                                    |
| Backend  | Hono                                             |
| Auth     | JWT + bcrypt + OAuth                             |
| Monorepo | Turborepo + pnpm                                 |
| Language | TypeScript                                       |
| Frontend | React 18, Vite, Tailwind v4, shadcn/ui (base-ui) |
| Data     | TanStack Query, TanStack Table                   |
| Forms    | React Hook Form (planned) + Zod                  |

## Project Structure

```
keyra/
├── apps/
│   ├── api/                    # Cloudflare Workers API
│   │   ├── e2e/                # Playwright E2E tests
│   │   └── src/
│   │       ├── lib/            # jwt, password, audit utilities
│   │       ├── middleware/     # auth, error, rateLimit
│   │       └── routes/         # auth, products, licenses, ...
│   └── dashboard/              # React admin UI
│       └── src/
│           ├── components/     # ui/, app-sidebar, app-topbar, ...
│           ├── lib/            # auth, date, utils
│           ├── routes/         # page components
│           ├── test/           # vitest setup
│           └── styles/         # global CSS
├── packages/
│   ├── api-client/             # Axios client for dashboard
│   ├── sdk-js/                 # Verification SDK
│   ├── shared-types/           # TypeScript types
│   └── shared-validation/      # Zod schemas
├── database/migrations/        # D1 schema
├── docs/                       # API_SPEC, ARCHITECTURE
├── infrastructure/cloudflare/  # IaC
└── .github/workflows/          # CI pipeline
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account

### Installation

```bash
git clone https://github.com/dt418/keyra.git
cd keyra
pnpm install
```

### Local Development

```bash
# Start API (port 8788) + Dashboard (port 5174) in parallel
pnpm dev

# Or individually:
pnpm dev:api
pnpm --filter @keyra/dashboard dev

# Seed local D1 with full demo dataset (2 users, 1 org, 3 products, 8 licenses, 5 devices, 5 activations, 2 webhooks, 3 deliveries)
bash apps/api/scripts/seed-all.sh         # bash
node --experimental-strip-types apps/api/scripts/seed-all.ts   # Node 22+ TS
pwsh apps/api/scripts/seed-all.ps1       # PowerShell

# Tests
pnpm test
pnpm --filter @keyra/api test:e2e  # Playwright

# Type check
pnpm typecheck

# Build
pnpm build

# Secret rotation (pushes .dev.vars to wrangler + gh secrets; never echoes)
bash scripts/sync-secrets.sh
```

### Environment Setup

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Fill in JWT_SECRET, JWT_REFRESH_SECRET, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
```

### Local Login (after seed)

```
admin@keyra.dev / admin123
demo@keyra.dev  / demo123
```

### Remote Database Setup

```bash
wrangler d1 create keyra-db --update-config
wrangler d1 migrations apply keyra-db --remote
wrangler kv namespace create sessions
```

## Deployment

```bash
cd apps/api
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET
wrangler deploy
```

GitHub Actions automatically deploy on push to `main`.

## Documentation

- [DESIGN.md](DESIGN.md) — Design system, tokens, layout, components, dark mode
- [AGENTS.md](AGENTS.md) — Agent guidance, critical rules, conventions
- [docs/API_SPEC.md](docs/API_SPEC.md) — Complete API reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design details
- [docs/superpowers/plans/audit-2026-06-18/](docs/superpowers/plans/audit-2026-06-18/) — 8 self-contained security plans (S0–S7)
- [CHANGELOG.md](CHANGELOG.md) — Version history

## Security

Security audit 2026-06-18 closed 9 P0 + 7 P1 + 1 P2 findings across 8 plans (feat-019..feat-026). See [CHANGELOG.md](CHANGELOG.md) `## [Unreleased] → ### Security Audit 2026-06-18` for the full list.

## Agent Support

This project includes configuration for AI coding agents:

- `AGENTS.md` — Universal agent guidance
- `CLAUDE.md` — Claude Code compatibility
- `.cursor/rules/keyra.mdc` — Cursor rules
- `.github/workflows/ci.yml` — CI pipeline

## Packages

| Package                      | Description                |
| ---------------------------- | -------------------------- |
| `apps/api`                   | Cloudflare Workers API     |
| `apps/dashboard`             | React admin UI             |
| `packages/api-client`        | Axios client for dashboard |
| `packages/sdk-js`            | Verification SDK           |
| `packages/shared-types`      | Shared TypeScript types    |
| `packages/shared-validation` | Zod validation schemas     |

## License

MIT

# Keyra

Cloud-native licensing platform for software distribution with device activation, license management, and secure authentication.

## Features

- **Device Activation** — Secure device registration with UUID-based identification
- **License Management** — Flexible license types (trial, free, paid tiers) with HMAC-signed keys (`raw.tag` format verified server-side)
- **Multi-tenant** — Organizations with role-based access control
- **Authentication** — JWT + Refresh tokens, OAuth (Google, GitHub), optional email verification (Resend + KV token)
- **Webhook Delivery** — HMAC-signed payloads with SSRF guard on outbound URLs (HTTPS-only, blocks loopback/private/internal)
- **Rate Limiting** — Per-scope + per-IP KV buckets + Durable Object `RateLimiter` for exact counts
- **Audit Logging** — Complete activity tracking
- **Admin Dashboard** — React 18 SPA with TanStack Table, command palette, dark mode, RHF + Zod forms

## Tech Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| API            | Cloudflare Workers (`keyra-api`)                   |
| Dashboard host | Cloudflare Pages project `keyra`                   |
| Database       | Cloudflare D1 (SQLite)                             |
| Cache          | Cloudflare KV                                      |
| Backend        | Hono                                               |
| Auth           | JWT + bcrypt + OAuth                               |
| Monorepo       | Turborepo + pnpm                                   |
| Language       | TypeScript                                         |
| Frontend       | React 18, Vite, Tailwind v4, shadcn/ui (base-ui)   |
| Data           | TanStack Query, TanStack Table                     |
| Forms          | React Hook Form + Zod (`@keyra/shared-validation`) |

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
# Fill in CORS_ALLOWED_ORIGINS (comma-separated; localhost defaults always work)
# Optionally fill in RESEND_API_KEY + RESEND_FROM_EMAIL for outbound email;
# leave blank for scaffold mode (see Email section below).
```

### Email (transactional, optional)

Email sending runs in **scaffold mode** when `RESEND_API_KEY` is unset: the API
logs the would-be message via `console.info` and resolves successfully. This
keeps local dev / CI runnable without a Resend account. Configure both vars to
actually deliver.

| Key                          | Type   | Required | Purpose                                                                                           |
| ---------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`             | secret |          | Resend HTTP API token                                                                             |
| `RESEND_FROM_EMAIL`          | var    |          | `From` address used on outgoing mail (e.g. `Keyra <no-reply@keyra.dev>`)                          |
| `REQUIRE_EMAIL_VERIFICATION` | var    |          | `1` blocks login until `users.email_verified=1`; default `0` (backwards-compat with seeded users) |
| `LICENSE_HMAC_SECRET`        | secret |          | 32-byte hex; signs/verifies license key HMAC tag                                                 |
| `APP_URL`                    | var    |          | Base URL for verify-email link (e.g. `http://localhost:5173`)                                     |
| `RESOLVE_DNS_FOR_SSRF`       | var    |          | `1` enables DNS-rebinding check on webhook URL guard                                             |

When `RESEND_API_KEY` is set, `POST /auth/register` and
`POST /auth/resend-verification` deliver through the Resend API. The
verification token is stored in KV under `verify-email:<token>` with a 24h TTL.

### Required GitHub repo secrets / variables

Set with `gh secret set` and `gh variable set -R dt418/keyra`:

| Key                     | Type     | Required | Purpose                                                                       |
| ----------------------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | secret   | ✓        | wrangler-action deploy                                                        |
| `CLOUDFLARE_ACCOUNT_ID` | secret   | ✓        | wrangler-action account                                                       |
| `JWT_SECRET`            | secret   | ✓        | API access-token signing                                                      |
| `JWT_REFRESH_SECRET`    | secret   | ✓        | API refresh-token signing                                                     |
| `CORS_ALLOWED_ORIGINS`  | secret   | ✓        | Comma-separated dashboard origins (prod + preview Pages URLs + custom domain) |
| `VITE_API_URL`          | variable | ✓        | Dashboard axios baseURL; inlined at build time                                |
| `OAUTH_*`               | secret   |          | Google/GitHub OAuth client ids + secrets                                      |
| `RESEND_API_KEY`        | secret   |          | Resend transactional email API token                                          |

`scripts/sync-secrets.sh` pushes all of the above from `apps/api/.dev.vars` to
`gh secret set` / `gh variable set` + `wrangler secret put`. Never echoes
values. `scripts/check-secrets.sh` runs as a lefthook pre-commit hook and
refuses commits containing known secret patterns.

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

GitHub Actions automatically deploy on push to `main`:

- **API** — `.github/workflows/deploy.yml` deploys `apps/api/` to Cloudflare
  Worker `keyra-api` (`https://keyra-api.danhthanh418.workers.dev/api/v1`).
  Reads `CORS_ALLOWED_ORIGINS` from a GH secret and injects via wrangler-action
  `vars:` so the deployed worker reads it as `c.env.CORS_ALLOWED_ORIGINS`.
- **Dashboard** — `.github/workflows/deploy-dashboard.yml` builds with
  `VITE_API_URL` inlined and deploys `apps/dashboard/dist` to Cloudflare Pages
  project **`keyra`** (`https://keyra-cl8.pages.dev`, custom domain
  `https://keyra.danhthanh.dev`). Note: the Pages project name is `keyra`,
  not `keyra-dashboard` — `apps/dashboard/wrangler.jsonc` `name` field is a
  local-only reference.

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

# Architecture

## Overview

Keyra is a cloud-native licensing platform deployed on Cloudflare. The API runs
on Cloudflare Workers with D1 (SQLite) for persistence and KV for high-speed
token storage. The admin dashboard is a static SPA deployed to Cloudflare Pages
project `keyra` (served at `keyra-cl8.pages.dev` and `keyra.danhthanh.dev`).
Built with React 18, Vite, Tailwind v4, and shadcn/ui (base-ui).

## Tech Stack

| Layer          | Technology                                                              |
| -------------- | ----------------------------------------------------------------------- |
| API runtime    | Cloudflare Workers (`keyra-api` → `keyra-api.danhthanh418.workers.dev`) |
| Dashboard host | Cloudflare Pages (`keyra` → `keyra-cl8.pages.dev` + custom domain)      |
| Framework      | Hono                                                                    |
| Database       | Cloudflare D1 (SQLite)                                                  |
| Cache          | Cloudflare KV                                                           |
| Auth           | JWT + bcrypt + OAuth (Google, GitHub)                                   |
| Monorepo       | Turborepo + pnpm                                                        |
| Language       | TypeScript                                                              |
| Frontend       | React 18, Vite, Tailwind v4, shadcn/ui (base-ui)                        |
| Data           | TanStack Query, TanStack Table                                          |
| Forms          | React Hook Form + Zod (`@keyra/shared-validation`)                      |
| Testing        | Vitest, Playwright                                                      |

## System Architecture

```
                        ┌──────────────────────────────────────────┐
                        │            Cloudflare Network             │
                        │                                          │
                        │   ┌────────────────────────────────┐     │
                        │   │  Pages project: keyra          │     │
                        │   │  (keyra-cl8.pages.dev)         │     │
                        │   │  Custom domain:                │     │
                        │   │  keyra.danhthanh.dev           │     │
                        │   │  ─────────────────────────────  │     │
                        │   │  React 18 + Vite + Tailwind v4  │     │
                        │   │  Built with VITE_API_URL=…      │     │
                        │   └───────────────┬────────────────┘     │
                        │                   │ HTTPS                │
                        │                   │                      │
                        │   ┌───────────────┴────────────────┐     │
                        │   │  Workers: keyra-api            │     │
                        │   │  (keyra-api.danhthanh418       │     │
                        │   │    .workers.dev)               │     │
                        │   │  ─────────────────────────────  │     │
                        │   │  Hono router                    │     │
                        │   │  Auth → Rate → Validate → Hdl  │     │
                        │   │  CORS reads CORS_ALLOWED_…     │     │
                        │   └───┬──────────────────┬─────────┘     │
                        │       │                  │               │
                        │       ▼                  ▼               │
                        │   ┌────────┐         ┌─────────┐        │
                        │   │   D1   │         │   KV    │        │
                        │   │SQLite  │         │ Tokens  │        │
                        │   └────────┘         └─────────┘        │
                        └──────────────────────────────────────────┘
                                        ▲
                                        │ HTTPS
                                        │
                                ┌───────┴───────┐
                                │   Browser     │
                                │   Dashboard   │
                                └───────────────┘
```

## Project Structure

```
keyra/
├── apps/
│   ├── api/                    # Cloudflare Workers API
│   │   ├── e2e/                # Playwright E2E tests
│   │   │   ├── auth.spec.ts
│   │   │   ├── orgs.spec.ts
│   │   │   ├── products.spec.ts
│   │   │   ├── products-e2e.spec.ts
│   │   │   ├── licenses-e2e.spec.ts
│   │   │   └── full-flow.spec.ts
│   │   ├── scripts/            # seed.sh, seed-all.{sh,ts,ps1}
│   │   └── src/
│   │       ├── index.ts         # Entry point + CORS env-driven origin
│   │       ├── router.ts        # Route aggregation
│   │       ├── openapi.ts       # OpenAPI spec
│   │       ├── middleware/     # auth, error, rateLimit, org
│   │       │   ├── auth.ts
│   │       │   ├── error.ts
│   │       │   ├── rateLimit.ts
│   │       │   └── org.ts        # requireOrgMember
│   │       ├── lib/             # Utilities
│   │       │   ├── jwt.ts       # JWT sign/verify
│   │       │   ├── password.ts  # bcrypt hashing
│   │       │   ├── audit.ts     # Audit logging
│   │       │   ├── sessions.ts  # persistSession → KV
│   │       │   └── context.ts   # typed OrgContext
│   │       └── routes/
│   │           ├── auth/         # register, login, oauth, refresh, logout, verify-email
│   │           ├── orgs/         # Organization + members
│   │           ├── users/        # /users/me
│   │           ├── products/     # Products + api-key
│   │           ├── licenses/     # Licenses + transfer + reset
│   │           ├── activations/  # activate, list, get, delete
│   │           ├── verify/       # POST /verify (public)
│   │           ├── devices/      # deactivate
│   │           ├── webhooks/     # CRUD + deliveries
│   │           ├── analytics/    # overview
│   │           └── audit-logs/   # list
│   └── dashboard/              # React 18 SPA (Vite → Pages)
│       ├── vite.config.ts
│       ├── wrangler.jsonc       # name: keyra-dashboard (local-only ref)
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx         # Entry
│           ├── App.tsx          # Routes
│           ├── routes/           # Page components
│           │   ├── _dashboard.tsx    # Protected layout (sidebar + topbar)
│           │   ├── _public.tsx       # Public layout (redirect)
│           │   ├── _protected.tsx    # Auth guard
│           │   ├── root.tsx
│           │   ├── dashboard.tsx     # Overview (KPIs, activity)
│           │   ├── login.tsx
│           │   ├── register.tsx
│           │   ├── organizations/
│           │   ├── products/
│           │   ├── licenses/
│           │   ├── devices/
│           │   ├── api-keys.tsx
│           │   ├── docs.tsx
│           │   ├── settings.tsx
│           │   └── support.tsx
│           ├── components/
│           │   ├── ui/               # shadcn primitives
│           │   │   ├── button.tsx
│           │   │   ├── card.tsx
│           │   │   ├── dialog.tsx
│           │   │   ├── dropdown-menu.tsx
│           │   │   ├── input.tsx
│           │   │   ├── password-input.tsx
│           │   │   ├── label.tsx
│           │   │   ├── select.tsx
│           │   │   ├── separator.tsx
│           │   │   ├── sheet.tsx
│           │   │   ├── skeleton.tsx
│           │   │   ├── tabs.tsx
│           │   │   ├── tooltip.tsx
│           │   │   ├── popover.tsx
│           │   │   ├── command.tsx
│           │   │   ├── confirm-dialog.tsx
│           │   │   ├── data-table.tsx
│           │   │   ├── empty-state.tsx
│           │   │   ├── page-header.tsx
│           │   │   ├── search-toolbar.tsx
│           │   │   ├── stat-card.tsx
│           │   │   └── status-badge.tsx
│           │   ├── app-sidebar.tsx    # 240px nav
│           │   ├── app-topbar.tsx     # Breadcrumbs + search
│           │   ├── command-palette.tsx # Ctrl+K
│           │   ├── mode-toggle.tsx
│           │   └── theme-provider.tsx
│           ├── lib/                # auth, date, utils
│           ├── test/               # vitest setup
│           └── styles/             # globals.css
├── packages/
│   ├── api-client/             # Axios client for dashboard (env-driven baseURL)
│   ├── sdk-js/                 # Verification SDK
│   ├── shared-types/           # TypeScript types
│   └── shared-validation/      # Zod schemas
├── database/migrations/         # D1 schema (13 migrations)
├── infrastructure/cloudflare/   # IaC
├── .agents/skills/             # AI agent skills
├── docs/                        # API_SPEC, ARCHITECTURE, plans, specs
├── scripts/                     # check-secrets.sh, sync-secrets.sh, ship-phase.sh, s1-refactor-handlers.js
├── .github/workflows/           # CI pipeline + Pages/Workers deploy
├── AGENTS.md                    # Universal agent guidance
├── CLAUDE.md                    # Claude Code compatibility
├── DESIGN.md                    # Design system
├── SKILLS.md                    # Skills documentation
└── README.md
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

### Auth Middleware Behavior

> **Important:** `authMiddleware` **returns a Response** (e.g. `c.json({error}, 401)`)
> rather than throwing. Tests must read the Response with `await result.json()`
> instead of `.rejects.toMatchObject()`.

### Org Membership Middleware

`requireOrgMember` middleware runs after auth and sets `c.get("orgId")` +
`c.get("orgRole")` on the Hono context. Handlers read these instead of running
inline `SELECT … FROM org_members` queries. Wired into products / licenses /
webhooks / analytics / audit-logs / devices routers.

### Token Security

| Token   | TTL    | Storage      | Secret               |
| ------- | ------ | ------------ | -------------------- |
| Access  | 15 min | Memory only  | `JWT_SECRET`         |
| Refresh | 7 days | KV + DB hash | `JWT_REFRESH_SECRET` |

### Password Security

- **Algorithm:** bcrypt with cost factor 12
- **No plaintext storage**
- **Timing-safe login:** dummy bcrypt compare on user-not-found to narrow
  timing leak.

### CORS

CORS origins are **env-driven**, never hardcoded in source. The API reads
`c.env.CORS_ALLOWED_ORIGINS` (comma-separated) at request time in
`apps/api/src/index.ts`. Localhost origins (`5173`, `3000`, `5174`) are always
allowed regardless of the env var so local dev never breaks.

Source of truth in CI: GitHub repo secret `CORS_ALLOWED_ORIGINS`. The
deploy workflow (`.github/workflows/deploy.yml`) passes it as `vars:` to
wrangler-action so the deployed worker reads it as `c.env.CORS_ALLOWED_ORIGINS`
at runtime. Local dev reads the same value from `apps/api/.dev.vars`.

```bash
# .dev.vars example
CORS_ALLOWED_ORIGINS=https://keyra.danhthanh.dev,https://keyra.pages.dev,https://keyra-cl8.pages.dev,https://develop.keyra.pages.dev
```

### Rate Limiting

| Endpoint         | Limit      |
| ---------------- | ---------- |
| `/auth/register` | 10 req/min |
| `/auth/login`    | 20 req/min |
| `/auth/logout`   | 10 req/min |
| `/auth/refresh`  | 30 req/min |
| `/auth/oauth/*`  | 20 req/min |
| `/verify`        | 60 req/min |
| `/activate`      | 30 req/min |

Per-(scope + ip + bucket) key `rl:<scope>:<ip>:<bucket>` with bucket windowing.
Throws `AppError RATE_LIMITED 429` with `Retry-After` header.

### Secret Hygiene

- No committed secrets. `apps/api/.dev.vars` is gitignored.
- `scripts/check-secrets.sh` greps staged diff for AWS / Stripe / GitHub /
  Cloudflare / JWT patterns; runs as lefthook pre-commit hook.
- `scripts/sync-secrets.sh` pushes `.dev.vars` → `wrangler secret put` +
  `gh secret set` (secrets) or `gh variable set` (vars). Never echoes values.

## Data Flow

```
Client Request
    │
    ▼
CORS check (c.env.CORS_ALLOWED_ORIGINS + localhost defaults)
    │
    ▼
Rate Limit (KV, per-scope bucket)
    │
    ▼
Auth Middleware (JWT) - returns Response on failure
    │
    ▼
Org Membership Middleware (requireOrgMember) - sets c.get("orgId") + c.get("orgRole")
    │
    ▼
Input Validation (Zod)
    │
    ▼
Business Logic
    │
    ├──▶ D1 (SQLite) — persistent data
    │
    ├──▶ KV — tokens / sessions
    │
    └──▶ Audit Log (D1)
    │
    ▼
Response Format: { data: ... } or { error: { code, message } }
```

## Environment Variables

### API (`apps/api/.dev.vars`, `apps/api/wrangler.jsonc`)

| Key                                  | Scope  | Required | Purpose                                                    |
| ------------------------------------ | ------ | -------- | ---------------------------------------------------------- |
| `JWT_SECRET`                         | secret | ✓        | Access-token signing                                       |
| `JWT_REFRESH_SECRET`                 | secret | ✓        | Refresh-token signing                                      |
| `OAUTH_REDIRECT_URI`                 | secret |          | OAuth callback base URL                                    |
| `OAUTH_GOOGLE_CLIENT_ID` / `_SECRET` | secret |          | Google OAuth                                               |
| `OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | secret |          | GitHub OAuth                                               |
| `CLOUDFLARE_API_TOKEN`               | secret |          | CI deploy (Pages + Workers)                                |
| `CLOUDFLARE_ACCOUNT_ID`              | secret |          | wrangler-action account                                    |
| `CORS_ALLOWED_ORIGINS`               | var    | ✓        | Comma-separated allowlist                                  |
| `ENVIRONMENT`                        | var    |          | (legacy placeholder; not template-substituted by wrangler) |

### Dashboard (`VITE_API_URL`, set as GitHub variable)

| Key | Scope | Purpose |
|-----|-------|---------|
| `VITE_API_URL` | GitHub variable (repo **and** `dashboard-production` / `dashboard-preview` environment) | Base URL for `packages/api-client` axios instance. Read at build time by Vite and inlined into the bundle. If unset, dashboard falls back to `/api/v1` (works with Vite dev proxy only). |

**Production:** `VITE_API_URL=https://keyra-api.danhthanh418.workers.dev/api/v1`.
Set on the `dashboard-production` GitHub Environment (the workflow's
`environment:` context scopes `${{ vars.X }}` to that env's variables) AND as
a repo-level variable so preview builds work too.

**Must include `/api/v1` suffix.** All api-client calls are relative
(`api.post("/auth/register", …)`), so the bundle resolves them as
`${VITE_API_URL}/auth/register`. Without the suffix the API 404s.

Set with:
```bash
gh variable set VITE_API_URL -R dt418/keyra \
  --body "https://keyra-api.danhthanh418.workers.dev/api/v1"
gh variable set VITE_API_URL -R dt418/keyra -e dashboard-production \
  --body "https://keyra-api.danhthanh418.workers.dev/api/v1"
```

Read by `.github/workflows/deploy-dashboard.yml` line 45 during the
`pnpm build` step.

## Deployment

### API (`apps/api/`)

- `.github/workflows/deploy.yml` — runs on push to `main` + PRs.
- Reads `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from GH secrets.
- Reads `CORS_ALLOWED_ORIGINS` from GH secret, passes to wrangler-action as
  `vars:` input so it becomes `c.env.CORS_ALLOWED_ORIGINS` at runtime.
- Worker name: `keyra-api`. Default URL:
  `https://keyra-api.danhthanh418.workers.dev/api/v1`.

### Dashboard (`apps/dashboard/`)

- `.github/workflows/deploy-dashboard.yml` — runs on push to `main` + PRs.
- Builds with `VITE_API_URL` from GH variables (prodn / preview branches).
- Deploys to Cloudflare Pages project **`keyra`** (NOT `keyra-dashboard`;
  the wrangler.jsonc `name` is a local-only reference and does not have to
  match the Pages project name).
- Default URL: `https://keyra-cl8.pages.dev`. Custom domain:
  `https://keyra.danhthanh.dev`. Preview URLs:
  `https://develop.keyra.pages.dev` and per-PR `https://<commit>.keyra-cl8.pages.dev`.

## Database Schema

13 migrations tracking full schema: users, organizations, org_members,
sessions, email_verification_tokens, products, licenses, devices, activations,
audit_logs, webhooks, webhook_deliveries, api_keys.

### Users

| Column         | Type    | Notes                                                     |
| -------------- | ------- | --------------------------------------------------------- |
| id             | TEXT    | UUID primary key                                          |
| email          | TEXT    | Unique, indexed                                           |
| name           | TEXT    | Optional                                                  |
| password_hash  | TEXT    | bcrypt                                                    |
| oauth_provider | TEXT    | google/github                                             |
| oauth_id       | TEXT    | Provider user ID                                          |
| avatar_url     | TEXT    | Profile image                                             |
| email_verified | INTEGER | 0/1 (set to 0 on register; verification flow is 501 stub) |
| created_at     | TEXT    | ISO timestamp                                             |
| updated_at     | TEXT    | ISO timestamp                                             |

### Organizations

| Column     | Type | Notes                        |
| ---------- | ---- | ---------------------------- |
| id         | TEXT | UUID primary key             |
| name       | TEXT | Organization name            |
| slug       | TEXT | Unique URL-safe identifier   |
| plan       | TEXT | free/pro/business/enterprise |
| settings   | TEXT | JSON configuration           |
| created_at | TEXT | ISO timestamp                |
| updated_at | TEXT | ISO timestamp                |

### Sessions

| Column             | Type | Notes                |
| ------------------ | ---- | -------------------- |
| id                 | TEXT | UUID primary key     |
| user_id            | TEXT | FK to users          |
| refresh_token_hash | TEXT | bcrypt hash          |
| user_agent         | TEXT | Browser/client info  |
| ip_address         | TEXT | Client IP            |
| expires_at         | TEXT | Expiration timestamp |
| created_at         | TEXT | ISO timestamp        |
| revoked_at         | TEXT | Revocation timestamp |

### Audit Logs

| Column     | Type | Notes                           |
| ---------- | ---- | ------------------------------- |
| id         | TEXT | UUID primary key                |
| user_id    | TEXT | Actor                           |
| action     | TEXT | user.register, user.login, etc. |
| ip_address | TEXT | Client IP                       |
| user_agent | TEXT | Client info                     |
| metadata   | TEXT | JSON context                    |
| created_at | TEXT | ISO timestamp                   |

## Dashboard Architecture

### Layout

```
┌──────┬───────────────────────────────────┐
│      │  Topbar (breadcrumbs, search)    │
│ Side ├───────────────────────────────────┤
│ bar  │                                   │
│ 240  │  Page Content                    │
│ px   │  (max-w-7xl or full)            │
└──────┴───────────────────────────────────┘
```

### State Management

- **Server state:** TanStack Query (cache, refetch, invalidation)
- **Auth state:** React Context (`useAuth()`)
- **Theme state:** React Context (`useTheme()`) with localStorage persistence
- **Local UI state:** useState

### Component Patterns

- **Pages:** Use `PageHeader` + `SearchToolbar`/`DataTable` + `EmptyState`
- **Dialogs:** Use shadcn `Dialog` for create/edit, `ConfirmDialog` for delete
- **Loading:** Use `Skeleton` matches, never spinners
- **Empty:** Always show `EmptyState` with primary CTA
- **Errors:** Toast via `sonner`
- **Auth forms:** Use `PasswordInput` (show/hide toggle, base-ui primitives)

## Response Format

```typescript
// Success
{ data: { ... } }

// List
{ data: T[], pagination: { cursor: string | null, has_more: boolean } }

// Error
{ error: { code: string, message: string, details?: [...] } }
```

## Error Codes

| Code                  | HTTP | Description                             |
| --------------------- | ---- | --------------------------------------- |
| UNAUTHORIZED          | 401  | Invalid/expired token                   |
| FORBIDDEN             | 403  | Insufficient permissions                |
| NOT_FOUND             | 404  | Resource not found                      |
| VALIDATION_ERROR      | 400  | Invalid request data                    |
| CONFLICT              | 409  | Resource already exists                 |
| RATE_LIMITED          | 429  | Too many requests                       |
| INTERNAL_ERROR        | 500  | Server error                            |
| OAUTH_NOT_CONFIGURED  | 500  | OAuth env vars missing                  |
| OAUTH_ALREADY_LINKED  | 409  | Email already bound to another provider |
| INVALID_PROVIDER      | 400  | OAuth provider not supported            |
| INVALID_STATE         | 400  | OAuth state validation failed           |
| TOKEN_EXCHANGE_FAILED | 502  | OAuth token exchange failed             |
| USERINFO_FAILED       | 502  | OAuth userinfo request failed           |
| EMAIL_NOT_PROVIDED    | 400  | OAuth provider did not provide email    |
| NOT_IMPLEMENTED       | 501  | Endpoint stub (e.g. email verification) |

## CI Pipeline

GitHub Actions runs:

1. `lint & typecheck` — all packages
2. `test-api` — 98 unit tests
3. `test-dashboard` — 70 unit tests
4. `test-sdk-js` — 9 unit tests
5. `test-shared-validation` — 28 unit tests
6. `build` — turbo build (depends on tests)
7. `e2e` — Playwright (depends on build)
8. `deploy-production` — on push to `main`: API via wrangler-action + Dashboard via Pages
9. `deploy-preview` — on PRs: API preview + Dashboard preview

Pinned to pnpm 10, Node 22.

## API Response Convention

> **All API responses use snake_case** even when the shared-types definitions
> use camelCase. The UI accesses fields like `product_id`, `max_devices`,
> `created_at`, `expires_at` directly without transformation.

## Theme System

- **Light mode:** CSS variables in `:root` block
- **Dark mode:** Same variables re-defined in `.dark` block
- **Tailwind v4:** `@theme inline` re-binds utility classes to variables
- **Storage:** `localStorage` key `keyra-ui-theme` (values: light/dark/system)
- **Application:** Inline script in `index.html` sets class before React mounts

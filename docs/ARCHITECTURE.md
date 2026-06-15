# Architecture

## Overview

Keyra is a cloud-native licensing platform deployed on Cloudflare Workers with D1
(SQLite) for persistence and KV for high-speed token storage. Includes an
admin dashboard SPA built with React 18, Vite, Tailwind v4, and shadcn/ui.

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
| Frontend | React 18, Vite, Tailwind v4, shadcn/ui (base-ui) |
| Data | TanStack Query, TanStack Table |
| Forms | React Hook Form (planned) + Zod |
| Testing | Vitest, Playwright |

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                       │
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
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Workers Assets (Dashboard SPA)          │  │
│  │  React 18 + Vite + Tailwind v4 + shadcn/ui          │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS
                              │
                       ┌──────┴──────┐
                       │   Browser  │
                       │  Dashboard │
                       └─────────────┘
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
│   │   └── src/
│   │       ├── index.ts         # Entry point
│   │       ├── router.ts        # Route aggregation
│   │       ├── openapi.ts       # OpenAPI spec
│   │       ├── middleware/     # Auth, rate limiting, error
│   │       │   ├── auth.ts
│   │       │   ├── error.ts
│   │       │   └── rateLimit.ts
│   │       ├── lib/             # Utilities
│   │       │   ├── jwt.ts       # JWT sign/verify
│   │       │   ├── password.ts  # bcrypt hashing
│   │       │   └── audit.ts     # Audit logging
│   │       └── routes/
│   │           ├── auth/         # Auth endpoints (register, login, oauth, etc)
│   │           ├── orgs/         # Organization endpoints
│   │           ├── users/        # User endpoints
│   │           ├── products/     # Product endpoints
│   │           ├── licenses/     # License endpoints
│   │           ├── activations/  # Activation endpoints
│   │           └── devices/      # Device endpoints
│   └── dashboard/              # React 18 SPA (Vite)
│       ├── vite.config.ts
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
│   ├── api-client/             # Axios client for dashboard
│   ├── sdk-js/                 # Verification SDK
│   ├── shared-types/           # TypeScript types
│   └── shared-validation/      # Zod schemas
├── database/migrations/         # D1 schema (10 migrations)
├── infrastructure/cloudflare/   # IaC
├── .agents/skills/             # AI agent skills
├── docs/                        # API_SPEC, ARCHITECTURE, plans, specs
├── .github/workflows/           # CI pipeline
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
Auth Middleware (JWT) - returns Response on failure
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
Response Format: { data: ... } or { error: { code, message } }
```

## Database Schema

10 migrations tracking full schema: users, organizations, org_members,
sessions, products, licenses, devices, activations, audit_logs.

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

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Invalid/expired token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## CI Pipeline

GitHub Actions runs:

1. `lint & typecheck` — all packages
2. `test-api` — 91 unit tests
3. `test-dashboard` — 32 unit tests
4. `build` — turbo build (depends on tests)
5. `e2e` — Playwright (depends on build)

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

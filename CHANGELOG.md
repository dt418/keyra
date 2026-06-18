# Changelog

All notable changes will be documented in this file.

## [Unreleased]

### Security Audit 2026-06-18 — 9 P0 + 7 P1 + 1 P2 closed (8/8 plans shipped)

#### feat-019 (S0) — Secret Rotation & Env Hygiene

- Removed committed JWT secrets and Cloudflare API token from `apps/api/.dev.vars`
- `apps/api/.gitignore` (explicit per-package) + root `.gitignore` (line 5) ignores `.dev.vars`
- `apps/api/.env.example` documents all required env vars (JWT*SECRET, JWT_REFRESH_SECRET, OAUTH*_, CLOUDFLARE\__)
- `scripts/check-secrets.sh` + `scripts/sync-secrets.sh` — secret rotation + pre-commit grep guard (AWS/JWT/Stripe/GitHub/Cloudflare patterns)
- `lefthook.yml` pre-commit now runs `secret-scan`
- All 4 secrets synced to `gh secret list -R dt418/keyra` and `wrangler secret list` (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, JWT_SECRET, JWT_REFRESH_SECRET)

#### feat-020 (S1) — Org-Membership Middleware

- New `apps/api/src/middleware/org.ts` — `requireOrgMember` middleware; sets `c.orgId` + `c.orgRole` on context
- New `apps/api/src/lib/context.ts` — typed `OrgContext` + Hono `ContextVariableMap` declarations
- 6 routers wired: `products/`, `licenses/`, `webhooks/`, `analytics/`, `audit-logs/`, `devices/`
- 26 handlers refactored from inline `SELECT org_id FROM org_members WHERE user_id=? AND role IN ('owner','admin')` to `c.get('orgId')`
- Special fixes: `products/api-key.ts` P2-2 (was bypassing AppError with `c.json({error},code)`); `products/get.ts` redundant subquery removed; `products/delete.ts` owner-only check preserved via `c.get('orgRole')`; `analytics/overview.ts` redundant local `getOrgId` helper removed
- Test fixtures: added `orgId` + `orgRole` to `c.get` mock in products + licenses handler tests

#### feat-021 (S2) — Products IDOR Fix

- `apps/api/src/routes/products/update.ts` — UPDATE + post-update SELECT now filter by `AND organization_id = ?`; empty-updates branch fixed
- Closes P0-1 (cross-tenant PATCH /products/:id)

#### feat-022 (S3) — Licenses Transfer IDOR Fix

- `apps/api/src/routes/licenses/transfer.ts` — source UPDATE filters by `AND organization_id = ?`; target-org membership enforced (caller must be admin/owner of destination)
- Closes P0-2 (cross-tenant POST /licenses/:id/transfer)

#### feat-023 (S4) — OAuth Hardening

- `apps/api/src/routes/auth/oauth.ts` — state now mandatory (rejects empty state with 400 INVALID_STATE)
- Email-match branch: fetches `oauth_provider, oauth_id`; rejects 409 OAUTH_ALREADY_LINKED if user already linked to a different provider; binds identity if unlinked
- Local `storeRefreshToken` deleted — replaced with `persistSession` from `lib/sessions.ts` which writes to KV (`session:<id>`, 'active'); now passes `userAgent` + `ipAddress`
- All 3 call sites hoist `requestInfo` and pass audit metadata
- 3 new tests (state required, account-takeover rejection, KV session write)
- Closes P0-3, P0-4, P0-5, P1-7

#### feat-024 (S5) — Public Endpoints Rate Limit

- `apps/api/src/middleware/rateLimit.ts` rewritten — per-(scope+ip+bucket) key `rl:<scope>:<ip>:<bucket>` with bucket windowing
- Throws `AppError RATE_LIMITED 429` with `Retry-After` header
- Applied to: `/verify` (60/min), `/activate` (30/min), `/auth/refresh` (30/min); existing auth limits migrated to new `{window, max, scope, respectDevFlag}` signature
- Closes P0-7, P1-8, P1-9

#### feat-025 (S6) — Verify/Activate Scope Reduction

- `apps/api/src/routes/verify/index.ts` — public success body now `{valid, expires_at, product_id, license_type}`; dropped `license_id`, `product_name`, `feature_flags`
- `apps/api/src/routes/activations/activate.ts` — public success body now `{activation_id, device_id, license_type, expires_at, activated_at}`; dropped `license_id`, `product_name`, `feature_flags`
- E2E `full-flow.spec.ts` updated to assert new shape
- Closes P0-8

#### feat-026 (S7) — Auth Flow Hygiene

- `apps/api/src/routes/auth/oauth.ts` — 3 sites throw `OAUTH_NOT_CONFIGURED 500` when `OAUTH_REDIRECT_URI` / `OAUTH_*_CLIENT_ID` / `OAUTH_*_CLIENT_SECRET` env vars missing
- `apps/api/src/routes/auth/login.ts` — dummy bcrypt compare on user-not-found (narrows timing leak)
- `apps/api/src/routes/auth/register.ts` — `email_verified=0` on INSERT (was 1)
- New `database/migrations/0013_email_verification.sql` — `email_verification_tokens` table + indexes
- New `apps/api/src/routes/auth/verify-email.ts` — 501 NOT_IMPLEMENTED stub mounted at `GET /auth/verify-email/:token`
- `apps/api/src/routes/orgs/delete.ts` — `DELETE FROM audit_logs WHERE org_id=?` before org_members cleanup
- Closes P1-1, P1-2, P1-3, P1-5

#### feat-027 — Show/Hide Password Toggle

- New `apps/dashboard/src/components/ui/password-input.tsx` — `PasswordInput` primitive (InputGroup + InputGroupAddon inline-end + InputGroupButton with Eye/EyeOff icons)
- `login.tsx` + `register.tsx` use `PasswordInput` (register uses for both password and confirmPassword)
- `aria-label`, `aria-pressed`, `type="button"` on toggle (does not submit form)
- 3 new tests in `__tests__/password-input.test.tsx`
- Dashboard tests 70/70 (was 67)

### Tooling

- `scripts/sync-secrets.sh` — pushes `.dev.vars` to `wrangler secret put` + `gh secret set` (never echoes)
- `scripts/seed-all.sh` / `seed-all.ts` / `seed-all.ps1` — comprehensive local seed (13 tables, 2 users, 1 org, 3 products, 8 licenses, 5 devices, 5 activations, 2 webhooks, 3 deliveries)
- `scripts/s1-refactor-handlers.js` — one-shot Node script used during S1 (kept for reference)

### Harness

- `feature_list.json` — feat-019..feat-027 added (8 audit + 1 new feature); all `done` except the deferred email-verification flow (501 stub)
- `progress.md` + `session-handoff.md` — updated to reflect audit phase complete + feat-027
- `docs/superpowers/plans/audit-2026-06-18/` — 8 self-contained plans (S0..S7), one per feat-019..feat-026
- `docs/superpowers/plans/audit-2026-06-18/README.md` — overview with sequencing + commit map

## [Unreleased — pre-audit]

### Added

- **Dashboard UI/UX Redesign** — Modern SaaS interface inspired by Stripe, Clerk, Vercel
  - Premium design system with 20+ reusable components (StatusBadge, EmptyState, StatCard, PageHeader, ConfirmDialog, SearchToolbar, DataTable)
  - shadcn/ui components built on base-ui primitives (render prop pattern, not asChild)
  - Sidebar (240px) + Topbar (sticky, breadcrumbs, search) + Content layout
  - Command palette (Ctrl+K / Cmd+K) with navigation, theme switching, sign out
  - Dark mode with `next-themes` + shadcn pattern, CSS variables in `:root`/`.dark` only
  - Skeleton loaders on every list/table page
  - EmptyState with icon + title + description + CTA on every page
  - 9 pages: Overview, Organizations, Products, Licenses, Devices, API Keys, Documentation, Settings, Support
- **Auth Pages** — Split-pane layout with gradient hero, feature highlights
- **Test Coverage** — 40 unit tests (dashboard) + 91 unit tests (API) + 5 E2E test files
- **Pagination** — Cursor-based pagination on Products, Organizations, Licenses, Devices
- **CRUD Dialogs** — Edit and delete dialogs for all entities, ConfirmDialog component for destructive actions
- **Documentation Pages** — SDK integration guide (install, configure, use) + API reference table
- **Design System** — DESIGN.md with full design tokens, layout, components, dark mode
- **Agent Tooling**
  - AGENTS.md — universal agent guidance
  - CLAUDE.md — Claude Code compatibility
  - SKILLS.md — installed skills and MCPs
  - 7 skills installed in `.agents/skills/` via `npx skills add`
  - `skills-lock.json` for reproducible installs

### Changed

- Button component now uses `React.forwardRef` to support base-ui render prop
- Auth middleware returns Response (does not throw) — tests updated
- Tests use `vitest --run` flag to avoid watch mode in CI
- Dashboard tsconfig now includes `vitest/globals` and `@testing-library/jest-dom`
- README updated to include dashboard, agent docs, all packages
- CSS variables consolidated: single set in `:root`/`.dark` (no `@theme` duplication)
- Inline script in `index.html` applies theme before React mounts (no FOUC)

### Fixed

- Dark mode CSS variables now properly scoped (was conflicting with `@theme inline`)
- Command palette arrow keys not working (base-ui Dialog traps events; moved to input onKeyDown)
- Command palette position (was `-73px` due to `-translate-y-1/2`)
- Command palette crash from cmdk's `subscribe()` undefined
- Vite proxy missing `/api` forward to API server
- API test mock context missing `c.json()` method

### Infrastructure

- CI workflow: typecheck, unit tests, build, E2E (5 jobs)
- Pinned to pnpm 10, Node 22
- `npx skills add` for project-level skill installation

## [1.0.0-alpha] - 2025-06-13

### Added

- **User Registration & Login**
  - Email/password authentication with secure password hashing
  - JWT access tokens (15 min) and refresh tokens (7 days)
  - Session management with token revocation

- **OAuth Authentication**
  - Google OAuth integration
  - GitHub OAuth integration
  - CSRF-protected OAuth flow

- **Organization Management**
  - Create, read, update, delete organizations
  - Role-based access control (owner/admin/member)
  - Cursor-based pagination

- **User Profile**
  - Get current user profile
  - Email verification tracking

- **Security**
  - Rate limiting per endpoint
  - Input validation with Zod schemas
  - Audit logging for all auth mutations
  - Secure token rotation

### Changed

- Replaced Argon2 with bcrypt for Workers compatibility

### Fixed

- Error response consistency (snake_case, standard error codes)
- Refresh token snake_case format
- GitHub OAuth token exchange format
- Session cleanup for expired/revoked tokens

### Documentation

- Comprehensive API specification
- Architecture documentation with diagrams
- Database schema reference
- Deployment guide

### Infrastructure

- CI/CD with GitHub Actions
- E2E tests with Playwright
- Cloudflare Workers deployment

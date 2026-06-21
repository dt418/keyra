# Changelog

All notable changes will be documented in this file.

## [Unreleased]

### feat-028 — Cloudflare Pages Deploy + Env-Driven CORS

#### Pages project name fix

- `.github/workflows/deploy-dashboard.yml` line 55: `--project-name=keyra-dashboard` → `--project-name=keyra`. The Pages project on this Cloudflare account is `keyra` (served at `keyra-cl8.pages.dev`); `keyra-dashboard` did not exist, so `wrangler-action v3` exited 1 with `[code: 8000007] Project not found` (stderr swallowed, only generic exit code shown). `apps/dashboard/wrangler.jsonc` `name: keyra-dashboard` is a local-only reference and does not have to match the Pages project name.

#### Env-driven CORS

- `apps/api/src/index.ts` — CORS origin resolver reads `c.env.CORS_ALLOWED_ORIGINS` (comma-separated string) at request time. Localhost defaults (`http://localhost:5173`, `http://localhost:3000`, `http://localhost:5174`) are always allowed regardless of env var. **No origins hardcoded in source.**
- `.github/workflows/deploy.yml` — both `deploy-production` and `deploy-preview` jobs pass `vars: CORS_ALLOWED_ORIGINS=${{ secrets.CORS_ALLOWED_ORIGINS }}` to wrangler-action, injected as `--var` at deploy time. Source of truth is the GitHub repo secret.
- `scripts/sync-secrets.sh` — adds `sync_var` helper; `CORS_ALLOWED_ORIGINS` and `VITE_API_URL` are now pushed via `gh variable set` (not `secret set`); `CLOUDFLARE_ACCOUNT_ID` now syncs as a secret.
- `scripts/check-secrets.sh` — fixed dangling reference to non-existent `scripts/rotate-secrets.sh` → now points to `scripts/sync-secrets.sh`.
- `docs/ARCHITECTURE.md` — added CORS section, deployment topology (Pages project `keyra` + custom domain `keyra.danhthanh.dev`), env-var reference table, updated test counts (98 api / 70 dashboard / 9 sdk-js / 28 shared-validation), updated architecture diagram, added `/verify` + `/activate` rate limits.
- `docs/API_SPEC.md` — added CORS section, environment variables table, additional error codes (`OAUTH_NOT_CONFIGURED`, `OAUTH_ALREADY_LINKED`, `NOT_IMPLEMENTED`).
- `README.md` — replaced ad-hoc deploy instructions with the actual GitHub Actions flow, documented required GH secrets/variables table, named the Pages project `keyra`.

#### Commits

- `f10b9cf` — fix(ci): target existing `keyra` Pages project (not `keyra-dashboard`)
- `f2eb04f` — feat(api): env-driven CORS via CORS_ALLOWED_ORIGINS
- `c0f6fc6` — fix(ci): inject CORS_ALLOWED_ORIGINS from GH secret via wrangler-action (no hardcoded vars)

### Security Audit 2026-06-18 — 9 P0 + 7 P1 + 1 P2 closed (8/8 plans shipped)

#### feat-019 (S0) — Secret Rotation & Env Hygiene

- Removed committed JWT secrets and Cloudflare API token from `apps/api/.dev.vars`
- `apps/api/.gitignore` (explicit per-package) + root `.gitignore` (line 5) ignores `.dev.vars`
- `apps/api/.env.example` documents all required env vars (JWT*SECRET, JWT_REFRESH_SECRET, OAUTH*\_, CLOUDFLARE\_\_)
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

### feat-029 — Email Verification Flow (commit `56f64da`)

- New `apps/api/src/lib/email.ts` — Resend HTTP client, env-aware scaffold mode (logs via `console.info` when `RESEND_API_KEY` is unset so local dev / CI run without a Resend account)
- New `apps/api/src/lib/email-templates/verify.ts` — verification email template (text + HTML)
- New `apps/api/src/routes/auth/resend-verification.ts` — POST `/auth/resend-verification` (rate-limited 5/min, always 200 for anti-enumeration)
- `apps/api/src/routes/auth/verify-email.ts` — replaced S7's `501 NOT_IMPLEMENTED` stub with KV token lookup (`verify-email:<uuid>`), `email_verified=1` flip on success, single-use token deletion
- `apps/api/src/routes/auth/register.ts` — issues verification token on registration + sends email
- `apps/api/src/routes/auth/login.ts` — gates on `REQUIRE_EMAIL_VERIFICATION=1`; returns `403 EMAIL_NOT_VERIFIED` when `email_verified=0`
- New error codes: `INVALID_VERIFICATION_TOKEN` (400), `EMAIL_NOT_VERIFIED` (403), `EMAIL_SEND_FAILED` (502)
- New env: `RESEND_API_KEY` (secret), `RESEND_FROM_EMAIL` (var), `REQUIRE_EMAIL_VERIFICATION` (var), `APP_URL` (var)

### feat-030 — Production Hardening (commit `fedb3a3`)

- New `apps/api/src/do/RateLimiter.ts` — Durable Object strict rate limiter (replaces KV-based limiter for routes that need exact counts; KV still used for /verify + /activate per-scope buckets)
- New `apps/api/src/lib/license.ts` — HMAC license key generation + verification (`raw.tag` format, `HMAC-SHA256(raw, LICENSE_HMAC_SECRET)` first 12 bytes reduced mod 36 → 36-symbol alphabet)
- New `apps/api/src/lib/url-guard.ts` — SSRF guard for webhook URLs (HTTPS-only, rejects loopback / private / link-local / unique-local IPv6 / internal TLDs / literal `localhost` / `metadata` / `metadata.google.internal`; optional DNS resolve when `RESOLVE_DNS_FOR_SSRF=1`)
- Wired into 5 routes (`POST /licenses`, `POST /activate`, `POST /verify`, `POST /devices/:token`) + 1 middleware (webhooks create/update/test)
- New error codes: `INVALID_LICENSE_KEY` (400), `WEBHOOK_URL_BLOCKED` (400)
- New env: `LICENSE_HMAC_SECRET` (secret, 32-byte hex), `RESOLVE_DNS_FOR_SSRF` (var)
- `apps/api/wrangler.jsonc` — durable_objects binding `RATE_LIMITER` + migration `v1 new_sqlite_classes: ["RateLimiter"]`

### feat-031 — RHF Migration for Remaining 7 Dialogs (commit `32cc290`)

- Migrated Create/Edit Product, Create/Edit Org, Create/Edit License, Create Webhook to React Hook Form + `zodResolver` + the shared primitives from feat-017
- Uses `TextField` / `TextareaField` / `NumberField` / `DateField` / `SelectField` / `MultiCheckboxField` / `CheckboxField` primitives
- 4 files modified, +683 / −294
- Closes the feat-017 follow-up "Migrate remaining 4 forms" (extended to 7 with Edit variants)

### Tooling

- Add `.prettierrc` (commit `20cac29`): `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`. Project-wide Prettier config; no code changes in this commit but future reformat passes will land cleanly.

### feat-030 — Post-deploy Gap Sweep (commits `82d7921`, `e04cced`, `3553132`, `cbe3ac8`, `5bb9f85`, `5d9e7eb`, `26aa8dd`)

Tests + secrets + docs fixes after feat-030 deploy:

- `82d7921`, `e04cced` — `apps/api/src/lib/app-url.ts` — `resolveAppUrl()` helper probes `http://localhost:5173` then `5174` for verify-email link when `APP_URL` is unset (previously failed to find local dashboard in scaffold mode). New file.
- `3553132` — `apps/api/src/lib/email.ts` — dropped the legacy `APP_URL` placeholder comment; `APP_URL` now resolved via `resolveAppUrl()` from `lib/app-url.ts`.
- `cbe3ac8` — ci: trigger deploy to verify secrets (RESEND_*, LICENSE_HMAC_SECRET, REQUIRE_EMAIL_VERIFICATION, APP_URL) — empty commit to re-run the deploy pipeline with the new secrets + vars now synced.
- `5bb9f85` — `apps/api/e2e/full-flow.spec.ts` — license key regex updated from `/^[A-Z0-9]{4}-([A-Z0-9]{4}-){2}[A-Z0-9]{4}$/` (legacy 4-char segments) to `/^[A-Z0-9]{5}-([A-Z0-9]{5}-){2}[A-Z0-9]{5}\.[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/` (feat-030 HMAC `raw.tag` format).
- `5d9e7eb` — `apps/api/e2e/webhooks-e2e.spec.ts` — delivery-failure test URL replaced with `https://blocked-by-ssrf.invalid` (RFC 2606 `.invalid` reserved TLD) so it passes feat-030's HTTPS-only SSRF guard without depending on a real blackhole host.
- `26aa8dd` — `apps/dashboard/src/routes/docs.tsx:51` — example string updated from `'XXXX-XXXX-XXXX-XXXX'` to `'XXXXX-XXXXX-XXXXX-XXXXX.AAAA-BBBB-CCCC'` to reflect HMAC format. `apps/dashboard/src/lib/license.ts` — `formatLicenseKey()` was matching input against `/.{1,4}/g` which would mangle HMAC keys (segmented them as 4-char regardless of structure); now an identity passthrough `return key ?? ''`. Latent landmine — function exported from `@/lib` but had no current callers.

Net effect: CI green for `26aa8dd`; all 3 secrets + 4 vars synced to Cloudflare + GitHub; production HMAC license keys + email verification flow operational.

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

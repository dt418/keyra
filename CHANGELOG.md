# Changelog

All notable changes will be documented in this file.

## [Unreleased]

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

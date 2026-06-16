# Keyra — Agent Guide

> This file mirrors `AGENTS.md` for Claude Code compatibility. See `AGENTS.md`
> for the canonical project guidance.

## Project

**Keyra** is a cloud-native license management platform. Monorepo:

- `apps/api` — Hono API on Cloudflare Workers + D1 (SQLite) + KV
- `apps/dashboard` — React 18 admin UI (Vite, Tailwind v4, shadcn/ui)
- `packages/api-client`, `packages/sdk-js`, `packages/shared-types`, `packages/shared-validation`
- `database/migrations/` — D1 schema

## Critical Rules

1. **API returns snake_case** — UI accesses `product_id`, `max_devices`, `created_at`, `expires_at` directly.
2. **Never add files at project root.** Use `apps/`, `packages/`, or `database/`.
3. **shadcn components use base-ui** (not radix). Use `render` prop instead of `asChild`. `Button` and `DropdownMenuTrigger` need `React.forwardRef`.
4. **CSS variables in `:root` and `.dark` only.** `@theme inline` re-binds Tailwind utilities. See `apps/dashboard/src/styles/globals.css`.
5. **Use `Skeleton` for loading states.** No spinners for page content.
6. **Every list page needs `<EmptyState>`** (icon + title + description + primary CTA).
7. **API errors:** `throw new AppError(code, message, status)` from `@/middleware/error`.
8. **Auth middleware returns Response, does not throw.** Tests read `await result.json()`, not `rejects.toMatchObject`.
9. **Theme storage key: `keyra-ui-theme`**. Values: `light` | `dark` | `system`.
10. **Read `DESIGN.md` before any UI work** — has the design tokens, layout patterns, and component list.

## Commands

```bash
pnpm install
pnpm dev:api            # → http://localhost:8788
pnpm --filter @keyra/dashboard dev  # → http://localhost:5174
pnpm typecheck
pnpm test              # 40 dashboard + 91 API unit tests
pnpm --filter @keyra/api test:e2e   # Playwright E2E
pnpm build
```

## Key Files

- `DESIGN.md` — design system, tokens, layout, components
- `AGENTS.md` — full agent guidance
- `.cursor/rules/keyra.mdc` — Cursor rules
- `apps/dashboard/src/App.tsx` — routes
- `apps/dashboard/src/lib/auth.tsx` — auth context
- `apps/dashboard/src/components/theme-provider.tsx` — theme
- `apps/dashboard/src/components/command-palette.tsx` — Cmd+K
- `apps/api/src/middleware/error.ts` — AppError
- `apps/api/src/middleware/auth.ts` — auth middleware
- `packages/shared-validation/src/` — Zod schemas
- `.github/workflows/ci.yml` — CI

## Common Pitfalls

- Forgetting `forwardRef` on Button → `render` prop needs it
- Using `asChild` instead of `render` — base-ui doesn't support `asChild`
- Adding `@theme` colors — use `:root`/`.dark` variables instead
- Skipping `queryClient.invalidateQueries` after mutations
- Using `as any` to bypass type errors — fix the types properly

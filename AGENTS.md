# AGENTS.md

This file provides guidance for AI agents (Claude Code, Cursor, opencode, etc.)
working on the Keyra codebase.

## Project Overview

**Keyra** is a cloud-native license management platform. The repo is a
pnpm + Turborepo monorepo containing:

- **`apps/api`** — Hono API running on Cloudflare Workers with D1 (SQLite) and KV
- **`apps/dashboard`** — Admin dashboard built with React 18, Vite, Tailwind v4, shadcn/ui
- **`packages/api-client`** — Axios client for the dashboard to call the API
- **`packages/sdk-js`** — Standalone JS SDK for license verification in customer apps
- **`packages/shared-types`** — Cross-package TypeScript types
- **`packages/shared-validation`** — Zod schemas
- **`database/`** — D1 schema and migrations
- **`infrastructure/cloudflare/`** — IaC for Cloudflare resources

## Critical Rules

1. **API responses use snake_case.** The shared-types definitions use camelCase,
   but the API still serializes snake_case. When building UI components, the
   `useQuery` callbacks return shapes that match the API response — do not
   rename fields.

2. **Never add files at the project root.** The repo root is reserved. New code
   lives inside `apps/`, `packages/`, or `database/`. Use `pnpm-workspace.yaml`
   and `turbo.json` for cross-package concerns.

3. **Follow the existing UI patterns.** Read `DESIGN.md` before touching the
   dashboard. Use the reusable components in `apps/dashboard/src/components/ui/`
   instead of building custom primitives. Status indicators use `StatusBadge`,
   empty states use `EmptyState`, confirmations use `ConfirmDialog`.

4. **shadcn components use base-ui, NOT radix-ui.** Patterns differ:
   - `render` prop instead of `asChild`
   - `useDirection` instead of `useDirection` etc.
   - Trigger and Button are forwardRef'd for ref forwarding through `render` prop.

5. **CSS variables in `:root` and `.dark` only.** Do not put colors in `@theme`.
   The `@theme inline` block re-binds the utility classes to these variables.
   See `apps/dashboard/src/styles/globals.css` for the canonical layout.

6. **No spinners for page content.** Use `<Skeleton>` for loading states.
   Spinners are only acceptable in `<div className="h-screen ...">` auth/initialization
   loading screens.

7. **Every list/table page must have an `<EmptyState>`.** See `DESIGN.md` for the
   pattern. Use `EmptyState` from `@/components/ui`.

8. **API error handling:** Throw `AppError` from `@/middleware/error` with
   `code`, `message`, `status`. Standard codes are documented in that file.

9. **Auth middleware returns Response, does not throw.** Tests must read
   `await result.json()` not `rejects.toMatchObject`. (Recent fix.)

10. **Theme storage key is `keyra-ui-theme`.** Values: `light` | `dark` | `system`.

## Development Commands

```bash
# Install
pnpm install

# Run API locally (Cloudflare Workers via wrangler)
pnpm dev:api        # → http://localhost:8788
pnpm --filter @keyra/api dev

# Run dashboard locally
pnpm --filter @keyra/dashboard dev   # → http://localhost:5174

# Run all tests
pnpm test
pnpm --filter @keyra/dashboard test  # 40 unit tests
pnpm --filter @keyra/api test         # 91 unit tests
pnpm --filter @keyra/api test:e2e     # Playwright

# Type check
pnpm typecheck

# Build
pnpm build

# Lint
pnpm lint
```

## Folder Conventions

### API (`apps/api/src/`)

- `lib/` — utilities (jwt, password, audit)
- `middleware/` — auth, rate limit, error
- `routes/<resource>/` — handler + router
- `routes/<resource>/__tests__/` — vitest unit tests
- `index.ts` — Hono app entry
- `router.ts` — route mounting

### Dashboard (`apps/dashboard/src/`)

- `components/ui/` — shadcn primitives (don't modify structure)
- `components/` — project-specific components (AppSidebar, AppTopbar, etc.)
- `lib/` — auth context, date utils, cn util
- `routes/` — page components
- `routes/_dashboard.tsx` — protected layout (sidebar + topbar)
- `routes/_public.tsx` — public layout (login/register redirect)
- `routes/_protected.tsx` — auth guard
- `test/setup.ts` — vitest test setup

## API Conventions

```typescript
// Handler signature
export async function createHandler(c: Context) {
  const userId = c.get("userId"); // from authMiddleware
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw parsed.error;

  // ... business logic ...

  return c.json({ data: { id, ...result } }, 201);
}
```

- All responses wrapped in `{ data: ... }` or `{ error: { code, message, details? } }`
- List endpoints return `{ data: T[], pagination: { cursor, has_more } }`
- Use `AppError` for domain errors
- Use Zod for input validation (from `@keyra/shared-validation`)

## UI Conventions

```tsx
// Page structure
export default function Products() {
  // 1. State
  const [isCreating, setIsCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  // 2. Data fetching with TanStack Query
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', cursor],
    queryFn: async () => {
      const res = await productsApi.list({ limit: 20, cursor });
      return res.data;
    },
  });

  // 3. Mutations
  const createMutation = useMutation({ ... });

  // 4. Render
  return (
    <div className="space-y-6">
      <PageHeader title="Products" icon={Package} actions={...} />
      <SearchToolbar value={search} onChange={setSearch} />
      {isLoading ? <SkeletonCards /> : products ? <Table /> : <EmptyState />}
      <Dialog open={isCreating}>...</Dialog>
    </div>
  );
}
```

## Testing

### Unit tests (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E tests (Playwright)

```typescript
import { test, expect, type APIRequestContext } from '@playwright/test';

test('my flow', async ({ request }) => {
  // API context for backend tests
  const res = await request.post('/path', { data: { ... } });
  expect(res.ok()).toBe(true);
});
```

## Git Workflow

- Single `main` branch
- Commits use conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`
- PRs are squashed or rebased
- CI must pass (typecheck, tests, build, e2e)
- **Auto-ship at phase end:** when a phase's work is complete and all gates are green, commit and push to main automatically. Do not ask for confirmation. Use `scripts/ship-phase.sh "<message>"` (runs all gates → commit → push) or run gates then `git commit` + `git push` inline.

## Common Pitfalls

1. **Forgetting `React.forwardRef` on Button** — base-ui `render` prop needs it.
2. **Using `asChild` instead of `render`** — base-ui doesn't support `asChild`.
3. **Adding `@theme` colors** — Put them in `:root` and `.dark` blocks only.
4. **Using `react-hook-form` without Zod resolver** — Always pair with `zodResolver`.
5. **Direct DOM mutations for theme** — Use `useTheme` hook instead.
6. **Test mocks missing `c.json()`** — API context tests need full Response methods.
7. **Forgetting to invalidate queries** — Use `queryClient.invalidateQueries` after mutations.

## Key Files

- `DESIGN.md` — design system, tokens, layout patterns
- `apps/dashboard/src/App.tsx` — route table
- `apps/dashboard/src/lib/auth.tsx` — auth context, org switcher
- `apps/dashboard/src/components/theme-provider.tsx` — theme logic
- `apps/dashboard/src/components/command-palette.tsx` — Cmd+K palette
- `apps/api/src/middleware/error.ts` — AppError, error middleware
- `apps/api/src/middleware/auth.ts` — auth middleware
- `apps/api/src/lib/jwt.ts` — token signing/verification
- `packages/shared-validation/src/` — Zod schemas
- `.github/workflows/ci.yml` — CI pipeline

## When in Doubt

1. Read `DESIGN.md` for UI questions
2. Read `apps/api/src/middleware/error.ts` for error patterns
3. Look at existing pages (e.g. `apps/dashboard/src/routes/products/`) for patterns
4. Run `pnpm typecheck` before committing
5. Run `pnpm test` to verify no regressions

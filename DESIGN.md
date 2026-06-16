# Keyra Design System

Comprehensive design documentation for the Keyra license management platform.

## Overview

Keyra is a license management dashboard built for modern teams. The UI follows a
premium SaaS aesthetic inspired by Stripe Dashboard, Clerk, Vercel, Linear, and
GitHub — information-dense, professional, and fast.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS v4 (CSS variables + custom-variant dark)
- **Components:** shadcn/ui (Base UI primitives)
- **Data:** TanStack Query, TanStack Table
- **Forms:** React Hook Form (planned), Zod
- **Icons:** Lucide React
- **Router:** React Router v6
- **Toasts:** Sonner
- **Backend:** Hono (Cloudflare Workers), D1 (SQLite)
- **SDK:** `@keyra/sdk-js` for license verification

## Folder Structure

```
apps/
  api/              Hono backend (Cloudflare Workers)
  dashboard/        Admin UI (React + Vite)
    src/
      components/
        ui/         shadcn primitives (Button, Dialog, Card, ...)
        app-sidebar.tsx
        app-topbar.tsx
        command-palette.tsx
        mode-toggle.tsx
        theme-provider.tsx
      lib/          auth.tsx, date.ts, utils.ts
      routes/       _dashboard.tsx, dashboard.tsx, products/, ...
      test/         setup.ts
packages/
  api-client/       Axios client for dashboard
  sdk-js/           Verification SDK
  shared-types/     TypeScript types
  shared-validation/ Zod schemas
.github/
  workflows/
    ci.yml          Lint, typecheck, test, build, E2E
```

## Design Tokens

### Color System (OKLCH)

Defined as CSS custom properties in `:root` (light) and `.dark` (dark) blocks.
Tailwind v4 `@theme inline` re-binds the utility classes to these variables so
`bg-background`, `text-foreground`, `border-border` all work.

Primary accent: violet/indigo. Status colors follow semantic naming:

- **Success** — emerald (`emerald-500/600`)
- **Warning** — amber (`amber-500/600`)
- **Danger** — rose (`rose-500/600`)
- **Info** — blue (`blue-500/600`)
- **Muted** — zinc/slate (`slate-500`, `zinc-500`)
- **Primary** — violet/indigo (`oklch(0.488 0.243 264.376)`)

### Typography

- **Font:** Geist Variable (sans) + Inter Variable fallback
- **Hierarchy:**
  - `text-3xl font-semibold` — page hero
  - `text-2xl font-semibold tracking-tight` — page title
  - `text-xl font-semibold tracking-tight` — section title (used in PageHeader)
  - `text-base font-medium` — card title
  - `text-sm` — body text
  - `text-xs` — metadata
  - `text-[10px]` — micro labels (badges, kbd shortcuts)

### Spacing

8px grid:
- `gap-2` (8px) — tight
- `gap-3` (12px) — comfortable
- `gap-4` (16px) — standard
- `gap-6` (24px) — section separator

Container padding: `px-6 py-6` (default), `lg:p-8` on large screens.

### Radius

- `--radius: 0.625rem` (10px) baseline
- Components use `rounded-xl`/`rounded-2xl` per shadcn defaults
- Special: `rounded-3xl` for modals/dialogs

### Shadows

Subtle by default, never heavy:
- `shadow-sm` for cards
- `shadow-lg` for popovers/dialogs
- `shadow-md` for hover elevations
- No drop-shadow effects

## Layout

### Application Shell

```
┌──────┬───────────────────────────────────┐
│      │  Topbar (breadcrumbs, search)    │
│ Side ├───────────────────────────────────┤
│ bar  │                                   │
│      │  Page Content                    │
│ 240  │  (max-w-7xl or full)            │
│ px   │                                   │
└──────┴───────────────────────────────────┘
```

- **Sidebar:** 240px fixed width, border-right, dark/light adaptive
- **Topbar:** 56px sticky height, backdrop-blur, breadcrumbs + search + notifications
- **Content:** Scrollable main area

### Sidebar Components

```
┌─ Logo + Theme Toggle
├─ Primary nav (Overview, Organizations, Products, Licenses, Devices)
├─ Separator
├─ Secondary nav (API Keys, Documentation, Settings, Support)
└─ User card + Logout
```

### Page Header

Every page uses `<PageHeader>` for consistent introduction:
- Icon (rounded-lg, primary/10 bg)
- Title (text-xl font-semibold tracking-tight)
- Description (text-sm text-muted-foreground)
- Actions (Button group on the right)

## Reusable Components

Located in `apps/dashboard/src/components/ui/`:

| Component | Purpose |
|-----------|---------|
| `Button` | Forwarded ref, base-ui primitive, cva variants |
| `Card` | Surface container, header/content/footer slots |
| `Dialog` | Modal/dialog, base-ui, ref-forwarded trigger |
| `DropdownMenu` | Context menus, base-ui |
| `Input` | Text input with consistent styling |
| `Label` | Form labels |
| `Select` | Native select wrapper |
| `Separator` | Horizontal/vertical divider |
| `Sheet` | Slide-out panel |
| `Skeleton` | Loading placeholder |
| `Tabs` | View switcher |
| `Tooltip` | Hover hints |
| `Popover` | Floating content |
| `Command` | Cmd+K palette (cmdk-based) |
| `EmptyState` | Icon + title + CTA pattern |
| `StatCard` | KPI tile with trend indicator |
| `StatusBadge` | Semantic status pill (success/warn/danger/info) |
| `PageHeader` | Page introduction block |
| `ConfirmDialog` | Destructive confirmation |
| `SearchToolbar` | Search input + actions row |
| `DataTable` | TanStack Table wrapper (sort, filter, pagination, column visibility) |

## StatusBadge

Semantic, ring-styled badges for status indicators. Replaces raw `<span>` with
inline `bg-green-100 text-green-700` to enforce contrast and theming.

```tsx
<StatusBadge variant="success">Active</StatusBadge>
<StatusBadge variant="warning">No API Key</StatusBadge>
<StatusBadge variant="danger">Revoked</StatusBadge>
<StatusBadge variant="info">Info</StatusBadge>
<StatusBadge variant="violet">Trial</StatusBadge>
<StatusBadge variant="slate">Disabled</StatusBadge>
```

In light mode: tinted background + dark text (`emerald-700` on `emerald-50`).
In dark mode: translucent background + light text (`emerald-400` on `emerald-500/10`).

## DataTable

Wraps TanStack Table v8 with sensible defaults:
- Sortable columns (header click)
- Column visibility toggle (gear icon → checkboxes)
- Global filter input
- Page size + page navigation
- Row selection (when enabled)
- Empty state slot

Used by Licenses and Devices pages for information density.

## Command Palette

`Ctrl+K` / `Cmd+K` opens a global palette:
- Navigation (5 routes with shortcut hints like "g o")
- Settings (4 routes)
- Theme switching (Light/Dark/System)
- Sign out

Built directly on base-ui `Dialog` (no cmdk) to avoid ref conflicts. Search
filters as the user types. Arrow keys navigate, Enter selects, Esc closes.

## Forms

Forms use controlled state with React Hook Form (planned) + Zod validation.
Currently simple controlled inputs in Dialog components.

Patterns:
- **Create:** Open in Dialog with form fields
- **Edit:** Open in Dialog with prefilled values
- **Delete:** ConfirmDialog with destructive styling

## Loading States

Three strategies by context:

1. **Page-level:** Skeleton matches final layout (cards, rows, list items)
2. **Component-level:** Inline `<Skeleton>` for individual fields
3. **Blocking:** Full-screen spinner for auth/initialization

Never use spinners for page content — they hide structure. Skeletons preserve
visual layout while content loads.

## Empty States

Every list/table page has an `<EmptyState>`:

```tsx
<EmptyState
  icon={Package}
  title="No products yet"
  description="Create your first product to start generating license keys"
  primaryAction={{ label: 'Create product', onClick: () => setIsCreating(true), icon: Plus }}
/>
```

Renders: icon (rounded-xl, primary/10 bg) + title + description + primary/secondary actions.

## Routing

```
/                       → redirect to /dashboard
/login, /register       → public (redirects to /dashboard if logged in)
/dashboard               → Overview
/dashboard/organizations
/dashboard/products
/dashboard/licenses
/dashboard/devices
/dashboard/api-keys
/dashboard/docs
/dashboard/settings
/dashboard/support
```

Auth state managed in `lib/auth.tsx` via React Context. `useAuth()` provides
`user`, `isLoading`, `orgs`, `currentOrg`, `switchOrg`, `login`, `logout`.

## Dark Mode

- Implementation: shadcn pattern with `ThemeProvider` context
- Storage key: `keyra-ui-theme` (values: light/dark/system)
- Inline script in `index.html` sets `light`/`dark` class on `<html>` before
  React mounts, preventing FOUC
- `matchMedia('(prefers-color-scheme: dark)')` listener for system mode
- Tailwind v4 `@custom-variant dark (&:is(.dark *));` so `dark:` utilities work

## Accessibility

- Focus rings on all interactive elements (`focus-visible:ring-3`)
- Keyboard navigation throughout (Tab, arrow keys, Enter, Escape)
- Semantic HTML (header, main, aside, nav)
- ARIA labels on icon-only buttons (`aria-label`, `sr-only`)
- Color contrast ≥ 4.5:1 for body text (WCAG AA)
- Status badges include `aria-label` for screen readers

## Testing

- **Unit tests:** Vitest + Testing Library (`pnpm --filter @keyra/dashboard test`)
- **E2E tests:** Playwright (`pnpm --filter @keyra/api test:e2e`)
- **Test counts:** 40 unit tests, 5 E2E test files

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`):

1. `lint` — typecheck all packages
2. `test-api` — API unit tests
3. `test-dashboard` — dashboard unit tests
4. `build` — turbo build (depends on lint + tests)
5. `e2e` — Playwright (depends on build)

Pinned to pnpm 10, Node 22.

## Responsive Behavior

- **Desktop (≥ 1024px):** Full sidebar + topbar layout
- **Tablet (768-1023px):** Sidebar visible, topbar still shown
- **Mobile (< 768px):** Sidebar collapses (planned), topbar adapts

Stats grids adapt: `sm:grid-cols-2 lg:grid-cols-4` for KPI cards.

## Performance

- Bundle size: 658KB JS, 95KB CSS (201KB JS gzipped, 15KB CSS gzipped)
- TanStack Query cache for data fetching
- Vite HMR for instant dev feedback
- Code splitting (planned for larger features)

## Design Principles Summary

1. **Information first** — data tables, compact cards, stats
2. **Consistent shell** — sidebar + topbar + content
3. **Tokens over hardcoded values** — `bg-background` not `bg-white`
4. **Semantic color** — variant-based badges, no random Tailwind colors
5. **Dark mode parity** — every surface, every state
6. **Loading skeletons** — never hide layout structure
7. **Empty states are designed** — icon + title + CTA, not just text

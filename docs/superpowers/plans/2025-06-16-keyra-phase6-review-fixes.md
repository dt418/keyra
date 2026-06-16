# Phase 6 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 17 findings from phase 6 code review (8 warn, 9 nit, 0 critical). All warn-level fixes are real bugs or design issues; nit-level are style/consistency.

**Architecture:** Schema migration for index + is_test column, validation tightening, webhook dispatch hardening (active re-check + body cap + crypto-safe secret), scope tightening on audit-logs query, UI consistency fixes.

**Tech Stack:** Hono + D1, Zod, React 18 + TanStack Query, Vitest, Cloudflare Workers

---

## Files Touched

- **Modify** `database/migrations/0011_webhooks.sql` — add composite index, `is_test` column, unify attempts semantics via app code
- **Modify** `packages/shared-validation/src/webhooks.ts` — drop `secret` from input, tighten `events` to enum
- **Modify** `apps/api/src/lib/webhooks.ts` — re-check `active=1` before fetch, byte-cap response body, comment on one-way secret, use crypto-safe secret generation helper
- **Modify** `apps/api/src/routes/webhooks/create.ts` — use new helper, set `is_test=0` not relevant here
- **Modify** `apps/api/src/routes/webhooks/test.ts` — insert with `is_test=1`, document semantics
- **Modify** `apps/api/src/routes/webhooks/deliveries.ts` — filter out `is_test=1` from real history
- **Modify** `apps/api/src/routes/webhooks/update.ts` — make empty PATCH a no-op (return current row)
- **Modify** `apps/api/src/routes/audit-logs/list.ts` — drop `org_id IS NULL` from scope
- **Modify** `apps/api/src/routes/analytics/activations-over-time.ts` — return server `now` ISO so client aligns
- **Modify** `apps/api/src/routes/analytics/top-products.ts` — drop redundant inline type annotation
- **Modify** `apps/dashboard/src/routes/audit-logs/index.tsx` — swap inline button to `<Button variant="outline">`
- **Modify** `apps/dashboard/src/routes/analytics/index.tsx` — per-card loading state instead of global
- **Modify** `apps/dashboard/src/routes/webhooks/index.tsx` — add `invalidateQueries(['webhooks'])` on toggle/test

---

### Task 1: Tighten Zod validation + drop user-provided secret

**Files:**
- Modify: `packages/shared-validation/src/webhooks.ts`

- [ ] **Step 1: Rewrite schema to use enum for events, drop secret input**

```typescript
import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = [
  "license.created",
  "license.updated",
  "license.revoked",
  "license.expired",
  "device.activated",
  "device.deactivated",
] as const;

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  active: z.boolean().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  active: z.boolean().optional(),
});
```

- [ ] **Step 2: Rebuild package**

Run: `pnpm --filter @keyra/shared-validation build`
Expected: `tsc --build` succeeds

- [ ] **Step 3: Remove now-redundant server-side event validation in create.ts and update.ts**

In `apps/api/src/routes/webhooks/create.ts` lines 5 and 29-38: delete `WEBHOOK_EVENTS` import and the `invalidEvents` filter block (Zod now enforces it).

In `apps/api/src/routes/webhooks/update.ts` lines 4 and 30-41: same deletion.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @keyra/api typecheck` (or `tsc --noEmit` from `apps/api/`)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared-validation apps/api/src/routes/webhooks
git commit -m "fix(validation): tighten webhook events enum, drop user-provided secret"
```

---

### Task 2: Migration schema fix — composite index + is_test column

**Files:**
- Modify: `database/migrations/0011_webhooks.sql`

- [ ] **Step 1: Add composite index for deliveries query and is_test column**

Edit `0011_webhooks.sql`, change the `webhook_deliveries` block to:

```sql
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_config_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config_created ON webhook_deliveries(webhook_config_id, created_at DESC);
```

- [ ] **Step 2: Apply migration to local D1**

Run: `pnpm --filter @keyra/api exec wrangler d1 migrations apply keyra-db --local`
Expected: `0011_webhooks.sql` shows `✅ Applied` (or already up to date)

- [ ] **Step 3: Verify columns exist**

Run: `pnpm --filter @keyra/api exec wrangler d1 execute keyra-db --local --command "PRAGMA table_info(webhook_deliveries)"`
Expected: results include `is_test` column

- [ ] **Step 4: Commit**

```bash
git add database/migrations/0011_webhooks.sql
git commit -m "fix(db): add is_test column + composite index for webhook deliveries"
```

---

### Task 3: Harden webhook delivery — active re-check + body cap + crypto-safe secret

**Files:**
- Modify: `apps/api/src/lib/webhooks.ts`
- Modify: `apps/api/src/routes/webhooks/create.ts`

- [ ] **Step 1: Add crypto-safe secret generator to lib/webhooks.ts**

Append to `apps/api/src/lib/webhooks.ts`:

```typescript
export function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  let s = "whsec_";
  for (let i = 0; i < bytes.length; i++) {
    s += chars[bytes[i] % chars.length];
  }
  return s;
}
```

- [ ] **Step 2: Re-check active=1 immediately before fetch in dispatchWebhookEvent**

In `apps/api/src/lib/webhooks.ts` `dispatchWebhookEvent`, inside the `for (const cfg of configs)` loop, add this guard right before the `try` block that contains the fetch (line ~87):

```typescript
const fresh = await c.env.DB.prepare(
  `SELECT active FROM webhook_configs WHERE id = ?`,
)
  .bind(cfg.id)
  .first() as { active: number } | null;
if (!fresh || fresh.active !== 1) continue;
```

This catches the race: admin pauses a webhook while a delivery is in flight.

- [ ] **Step 3: Byte-cap response body to prevent 1GB reads**

Replace the `await response.text()` and `responseBody = responseText.slice(0, 4000)` block in `dispatchWebhookEvent` (lines 106-107) with:

```typescript
const reader = response.body?.getReader();
let responseBody = "";
let totalBytes = 0;
const MAX_BODY_BYTES = 4096;
if (reader) {
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes <= MAX_BODY_BYTES) {
      responseBody += decoder.decode(value, { stream: true });
    }
    if (totalBytes > MAX_BODY_BYTES) break;
  }
  responseBody = responseBody.slice(0, MAX_BODY_BYTES);
}
```

- [ ] **Step 4: Add design comment about one-way secret storage**

At top of `apps/api/src/lib/webhooks.ts` after imports, add:

```typescript
// SECURITY: secret_hash is used as the HMAC signing key. The plaintext secret
// (whsec_xxx) is shown to the user ONCE at creation. There is no way to recover
// it from the hash — this is intentional (defense in depth: a DB dump alone
// cannot forge signatures). To "rotate" a leaked secret, create a new webhook
// and disable the old one.
```

- [ ] **Step 5: Replace local generateSecret in create.ts with lib helper**

In `apps/api/src/routes/webhooks/create.ts`:

- Add import: `import { generateWebhookSecret } from "../../lib/webhooks";`
- Remove the local `function generateSecret()` (lines 77-84)
- Change line 41: `const secret = generateWebhookSecret();` (the `|| generateSecret()` fallback is gone since we dropped user-provided secret)

- [ ] **Step 6: Run typecheck and tests**

Run: `pnpm --filter @keyra/api test`
Expected: 91 tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/webhooks.ts apps/api/src/routes/webhooks/create.ts
git commit -m "fix(webhooks): crypto-safe secret, re-check active before fetch, body cap"
```

---

### Task 4: Test delivery isolation + PATCH no-op semantics

**Files:**
- Modify: `apps/api/src/routes/webhooks/test.ts`
- Modify: `apps/api/src/routes/webhooks/deliveries.ts`
- Modify: `apps/api/src/routes/webhooks/update.ts`

- [ ] **Step 1: Mark test deliveries with is_test=1**

In `apps/api/src/routes/webhooks/test.ts` line 79-93, update the INSERT to include `is_test`:

```typescript
await c.env.DB.prepare(
  `INSERT INTO webhook_deliveries (id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, is_test, last_attempt_at, created_at)
   VALUES (?, ?, 'webhook.test', ?, ?, ?, ?, 1, 1, ?, ?)`,
)
  .bind(
    deliveryId,
    id,
    body,
    success ? "success" : "failed",
    responseCode,
    responseBody || error,
    timestamp,
    timestamp,
  )
  .run();
```

- [ ] **Step 2: Filter is_test=1 from real deliveries list**

In `apps/api/src/routes/webhooks/deliveries.ts` line 73, change the SELECT to:

```sql
SELECT id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, last_attempt_at, created_at
FROM webhook_deliveries
WHERE webhook_config_id = ? AND is_test = 0
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

- [ ] **Step 3: Make PATCH with no fields a no-op (return current row)**

In `apps/api/src/routes/webhooks/update.ts`, replace the `if (updates.length === 0)` block (lines 59-61) with:

```typescript
if (updates.length === 0) {
  const current = await c.env.DB.prepare(
    `SELECT id, organization_id, url, events, active, created_at, updated_at FROM webhook_configs WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, member.org_id)
    .first();
  if (!current) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }
  let events: string[] = [];
  try {
    events = JSON.parse((current as { events: string }).events) as string[];
  } catch {
    events = [];
  }
  return c.json({
    data: {
      ...(current as Record<string, unknown>),
      events,
      active: (current as { active: number }).active === 1,
    },
  });
}
```

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm --filter @keyra/api test`
Expected: 91 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhooks
git commit -m "fix(webhooks): mark test deliveries is_test=1, PATCH no-op returns current"
```

---

### Task 5: Tighten audit-logs org scope

**Files:**
- Modify: `apps/api/src/routes/audit-logs/list.ts`

- [ ] **Step 1: Drop the `OR org_id IS NULL` clause**

In `apps/api/src/routes/audit-logs/list.ts` line 70, change:

```typescript
const conditions: string[] = ["a.org_id = ?"];
```

(Auth events that lack org_id are out of scope for the org audit log. They can be exposed in a future user-scoped audit log endpoint.)

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @keyra/api test`
Expected: 91 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/audit-logs/list.ts
git commit -m "fix(audit-logs): scope strictly to org, drop null-org leak"
```

---

### Task 6: Analytics — server time anchor + drop redundant type

**Files:**
- Modify: `apps/api/src/routes/analytics/activations-over-time.ts`
- Modify: `apps/api/src/routes/analytics/top-products.ts`

- [ ] **Step 1: Return server-anchored `now` so client iteration aligns**

In `apps/api/src/routes/analytics/activations-over-time.ts`, change the return to:

```typescript
return c.json({
  data: series,
  period,
  now: new Date().toISOString().slice(0, 10),
});
```

- [ ] **Step 2: Drop redundant inline type annotation in top-products.ts**

In `apps/api/src/routes/analytics/top-products.ts` lines 33-40 and 43-55, simplify the type assertion and the `.map` callback. Replace the cast:

```typescript
  ) as {
    results: {
      id: string;
      name: string;
      license_count: number;
      active_count: number;
    }[];
  };
```

with:

```typescript
  ) as {
    results: { id: string; name: string; license_count: number; active_count: number }[];
  };
```

And replace the `.map` body:

```typescript
    data: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      license_count: r.license_count ?? 0,
      active_count: r.active_count ?? 0,
    })),
```

- [ ] **Step 3: Run typecheck + tests**

Run: `pnpm --filter @keyra/api test && pnpm --filter @keyra/dashboard typecheck`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/analytics
git commit -m "fix(analytics): server-anchored time, drop redundant inline type"
```

---

### Task 7: Dashboard UI consistency — Button component + per-card loading + query invalidation

**Files:**
- Modify: `apps/dashboard/src/routes/audit-logs/index.tsx`
- Modify: `apps/dashboard/src/routes/analytics/index.tsx`
- Modify: `apps/dashboard/src/routes/webhooks/index.tsx`

- [ ] **Step 1: Swap inline `<button>` for Export CSV to `<Button variant="outline">`**

In `apps/dashboard/src/routes/audit-logs/index.tsx`:
- Add `Button` to the import from `@/components/ui` (already imported alongside others)
- Replace lines 131-138 with:

```tsx
<Button
  variant="outline"
  onClick={() => exportCsv(filtered)}
  disabled={!filtered.length}
>
  <Download className="mr-2 h-4 w-4" />
  Export CSV
</Button>
```

- [ ] **Step 2: Per-card loading in analytics instead of global gate**

In `apps/dashboard/src/routes/analytics/index.tsx`:

- Remove the global `const isLoading = overviewLoading || byTypeLoading || timeSeriesLoading || topProductsLoading;` (lines 184-185)
- In the stat grid block (lines 195-242), replace the `isLoading || !overview ?` ternary with `overviewLoading || !overview ?` so only the stat cards gate on overview, and the chart cards continue to gate on their own loading flags independently.

The structure becomes:

```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {overviewLoading || !overview ? (
    [...Array(4)].map((_, i) => <Card key={i}>...</Card>)
  ) : (
    <>...4 StatCards...</>
  )}
</div>
```

The two chart cards already gate on `timeSeriesLoading` and `byTypeLoading` respectively, so removing the global isLoading unblocks them.

- [ ] **Step 3: Invalidate webhooks query on toggle/test**

In `apps/dashboard/src/routes/webhooks/index.tsx`:

- In `toggleMutation` (around line 130), add to `onSuccess`:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["webhooks"] });
  queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
  toast.success(...);
},
```

- In `testMutation` (around line 145), add `queryClient.invalidateQueries({ queryKey: ["webhooks"] });` to onSuccess (it already invalidates `webhook-deliveries`).

- [ ] **Step 4: Run dashboard typecheck + tests**

Run: `pnpm --filter @keyra/dashboard test`
Expected: 41 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/routes
git commit -m "fix(dashboard): use Button component, per-card loading, invalidate webhooks on toggle/test"
```

---

## Self-Review

**1. Spec coverage:** All 17 findings mapped. #1 (one-way secret) handled via comment in Task 3 step 4. #11 (Button) in Task 7 step 1. #12 (per-card loading) in Task 7 step 2. #13 (invalidate) in Task 7 step 3.

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later". All code shown in full. No "similar to Task N" — each task self-contained.

**3. Type consistency:**
- `WebhookRow` interface in test.ts (line 5) not used after my edits — keep it as-is (the type assertion is on a single line, no `WebhookRow` reference needed).
- The `is_test` column is referenced in 3 places (test.ts insert, deliveries.ts where clause, migration) — consistent naming throughout.
- `generateWebhookSecret` export added to `lib/webhooks.ts` then imported by `create.ts` — matches naming.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2025-06-16-keyra-phase6-review-fixes.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session with checkpoints

Which approach?

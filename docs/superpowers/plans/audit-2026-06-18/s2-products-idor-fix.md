# S2 — Products IDOR Fix

> Closes: **P0-1** (PATCH `/products/:id` cross-tenant write).

## Goal

Make `PATCH /products/:id` reject any update where the product does not belong to the caller's `orgId` (set by `requireOrgMember`). Apply the same filter to the post-update `SELECT`.

## File Structure

```
apps/api/src/routes/products/
├── update.ts                # EDIT — add org filter
└── __tests__/
    └── update.test.ts       # CREATE — cross-tenant rejection test
```

Depends on: **S1** (middleware sets `orgId` on context).

---

## Task 1: Add org filter to UPDATE

**Files:**

- Edit: `apps/api/src/routes/products/update.ts`

- [ ] **Step 1: Replace the UPDATE WHERE clause**

In `update.ts`, after parsing the body and building the `updates` array, the existing query is:

```typescript
const result = await c.env.DB.prepare(
  `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
)
  .bind(...params)
  .run();
```

Change it to:

```typescript
const orgId = c.get("orgId");
if (!orgId)
  throw new AppError("FORBIDDEN", "Admin or owner role required", 403);

const result = await c.env.DB.prepare(
  `UPDATE products SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`,
)
  .bind(...params, orgId)
  .run();
```

The order in `params` already includes `id` at the end (line 66 of original: `params.push(id);`), so appending `orgId` after is correct.

- [ ] **Step 2: Replace the post-update SELECT**

Change the second query (lines 78-82 of the original):

```typescript
const product = await c.env.DB.prepare(
  `SELECT id, name, description, created_at, updated_at FROM products WHERE id = ?`,
)
  .bind(id)
  .first() as { ... } | null;
```

to:

```typescript
const product = await c.env.DB.prepare(
  `SELECT id, name, description, created_at, updated_at
   FROM products WHERE id = ? AND organization_id = ?`,
)
  .bind(id, orgId)
  .first() as { ... } | null;
```

- [ ] **Step 3: Mirror in the "empty updates" branch (lines 42-46)**

The no-op branch also reads `SELECT ... WHERE id = ?`. Add the same `AND organization_id = ?` filter, and use the same `orgId` for the `bind`. If the product is not in the caller's org, return 404 (not 403) to avoid disclosing existence.

## Task 2: Cross-tenant rejection test

**Files:**

- Create: `apps/api/src/routes/products/__tests__/update.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { updateProductHandler } from "../update";
import { errorHandler } from "../../../middleware/error";
import { requireOrgMember } from "../../../middleware/org";
import { authMiddleware } from "../../../middleware/auth";

function makeEnv(updates: { changes: number } = { changes: 1 }) {
  return {
    DB: {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({
          run: async () => ({ meta: { changes: updates.changes } }),
          first: async () => null,
        }),
      })),
    },
  };
}

describe("PATCH /products/:id", () => {
  it("attaches organization_id to the UPDATE so cross-tenant writes fail", async () => {
    const seenSql: string[] = [];
    const env = {
      DB: {
        prepare: vi.fn((sql: string) => {
          seenSql.push(sql);
          return {
            bind: () => ({
              run: async () => ({ meta: { changes: 0 } }),
              first: async () => null,
            }),
          };
        }),
      },
    };

    const app = new Hono();
    app.use("/*", async (c, next) => {
      c.set("userId", "u_admin");
      c.set("orgId", "org_a");
      await next();
    });
    app.patch("/:id", updateProductHandler);
    app.onError(errorHandler);
    (app as any).env = env;

    const res = await app.request("/prod_xyz", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "renamed" }),
    });

    expect(res.status).toBe(404);
    const updateSql = seenSql.find((s) => s.startsWith("UPDATE products"));
    expect(updateSql).toBeDefined();
    expect(updateSql).toMatch(/WHERE id = \? AND organization_id = \?/);
  });
});
```

## Verification

```bash
./init.sh quick
```

Expect: new test passes; existing `products/__tests__/*` tests still pass.

## Acceptance

- [ ] `update.ts:68-72` SQL contains `WHERE id = ? AND organization_id = ?`.
- [ ] `update.ts:78-82` post-update SELECT contains `AND organization_id = ?`.
- [ ] New `update.test.ts` test passes.
- [ ] No regression in existing products tests.

## Rollback

```bash
git revert <s2-commit>
```

The product PATCH would revert to cross-tenant-writable.

## Closes

- **P0-1** — IDOR on `PATCH /products/:id`.

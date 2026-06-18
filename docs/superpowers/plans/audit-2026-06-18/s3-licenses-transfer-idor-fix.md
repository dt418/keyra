# S3 — Licenses Transfer IDOR Fix

> Closes: **P0-2** (`POST /licenses/:id/transfer` UPDATE has no org filter; target-org ownership unchecked).

## Goal

Two fixes:

1. The source-license `UPDATE` (sets `status='transferred'`) must include `AND organization_id = ?`.
2. The destination-org must be verified to exist AND the caller must be a member of it (owner or admin).

## File Structure

```
apps/api/src/routes/licenses/
├── transfer.ts              # EDIT — two SQL additions
└── __tests__/
    └── transfer.test.ts     # CREATE — both rejections
```

Depends on: **S1** (middleware sets `orgId`).

---

## Task 1: Add org filter to the source UPDATE

**Files:**

- Edit: `apps/api/src/routes/licenses/transfer.ts`

- [ ] **Step 1: Add `AND organization_id = ?` to the source UPDATE**

Lines 57-61 currently:

```typescript
await c.env.DB.prepare(
  `UPDATE licenses SET status = 'transferred', transferred_at = ?, updated_at = ? WHERE id = ?`,
)
  .bind(now, now, id)
  .run();
```

Replace with:

```typescript
const orgId = c.get("orgId");
if (!orgId)
  throw new AppError("FORBIDDEN", "Admin or owner role required", 403);

await c.env.DB.prepare(
  `UPDATE licenses SET status = 'transferred', transferred_at = ?, updated_at = ?
   WHERE id = ? AND organization_id = ?`,
)
  .bind(now, now, id, orgId)
  .run();
```

Note: this is fire-and-broadcast — `await ... .run()` does not surface a `meta.changes` value, so we still need a follow-up check (the next SELECT on the new license row would catch a missing source). Add a `meta.changes === 0` check to the next query or rely on the `INSERT` to throw. Preferred: read the `meta.changes` and throw 404 if 0.

- [ ] **Step 2: Tighten the target-org ownership check**

Lines 45-53 currently:

```typescript
const targetOrg = (await c.env.DB.prepare(
  `SELECT id, name FROM organizations WHERE id = ?`,
)
  .bind(target_org_id)
  .first()) as { id: string; name: string } | null;

if (!targetOrg) {
  throw new AppError("NOT_FOUND", "Target organization not found", 404);
}
```

Add a check that the caller is an owner/admin of the target org too (or that the target org is a free-tier org that auto-accepts transfers — TBD product decision). Recommended: require caller to be admin/owner of the target org. Implementation:

```typescript
// Check caller is member of target org with owner/admin role
const targetMembership = (await c.env.DB.prepare(
  `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND role IN ('owner','admin') LIMIT 1`,
)
  .bind(target_org_id, c.get("userId"))
  .first()) as { role: string } | null;

if (!targetMembership) {
  // Do not disclose whether the target org exists; use 404.
  throw new AppError("NOT_FOUND", "Target organization not found", 404);
}
```

If the product wants to allow transfer to a brand-new org (or any org), this gate needs a different design — confirm with product before implementing. The default above is "caller must be member of destination".

## Task 2: Tests

**Files:**

- Create: `apps/api/src/routes/licenses/__tests__/transfer.test.ts`

- [ ] **Step 1: Test cross-tenant source**

```typescript
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { transferLicenseHandler } from "../transfer";
import { errorHandler } from "../../../middleware/error";

describe("POST /licenses/:id/transfer", () => {
  it("attaches organization_id to the source UPDATE", async () => {
    const seenSql: string[] = [];
    const env = {
      DB: {
        prepare: vi.fn((sql: string) => {
          seenSql.push(sql);
          return {
            bind: () => ({
              run: async () => ({ meta: { changes: 1 } }),
              first: async () => null, // no source license in caller org
              all: async () => ({ results: [] }),
            }),
          };
        }),
      },
    };

    const app = new Hono();
    app.use("/*", async (c, next) => {
      c.set("userId", "u1");
      c.set("orgId", "org_a");
      await next();
    });
    app.post("/:id/transfer", transferLicenseHandler);
    app.onError(errorHandler);
    (app as any).env = env;

    const res = await app.request("/lic_xyz/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_org_id: "org_b" }),
    });

    // 404 because the source license lookup returns null
    expect([404, 403]).toContain(res.status);
    const updateSql = seenSql.find((s) =>
      s.startsWith("UPDATE licenses SET status"),
    );
    expect(updateSql).toMatch(/organization_id/);
  });
});
```

- [ ] **Step 2: Test caller not member of target org**

Same shape; assert that when `org_members` returns no row for `(org_b, u1)`, the response is 404 and no `INSERT` happens.

## Verification

```bash
./init.sh quick
```

## Acceptance

- [ ] Source UPDATE contains `AND organization_id = ?`.
- [ ] Target-org membership check is enforced.
- [ ] Two new tests pass.
- [ ] Existing `licenses/__tests__/*` still pass.

## Rollback

```bash
git revert <s3-commit>
```

## Closes

- **P0-2** — cross-tenant write via `/licenses/:id/transfer`.

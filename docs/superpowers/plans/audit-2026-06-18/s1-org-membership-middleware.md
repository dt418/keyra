# S1 — Org-Membership Middleware

> Closes: **P2-1** (31x duplicated `org_members` query) AND unlocks clean IDOR fixes in S2/S3.

## Goal

Replace 31 copies of the inline `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner','admin') LIMIT 1` with a Hono middleware that puts `orgId` and `orgRole` on the context. Add an `OwnershipContext` type so handlers stop re-declaring the SQL. Keep backward compatibility with handlers that still need the `member.org_id` variable (refactor them in this plan).

## File Structure

```
apps/api/src/
├── middleware/
│   ├── auth.ts                  # UNCHANGED
│   └── org.ts                   # CREATE — new middleware
├── lib/
│   └── context.ts               # CREATE — typed ctx helpers (orgId, orgRole)
├── routes/
│   ├── products/                # refactor (list, get, update, delete, create, api-key)
│   ├── licenses/                # refactor (all)
│   ├── orgs/                    # refactor (get, update, delete; create stays)
│   ├── webhooks/                # refactor (all)
│   ├── analytics/               # refactor (all)
│   ├── audit-logs/              # refactor (list)
│   ├── activations/             # refactor (activate)
│   └── devices/                 # refactor (deactivate)
└── router.ts                    # UNCHANGED (middleware applied per-router)
apps/api/src/middleware/__tests__/
└── org.test.ts                  # CREATE
```

---

## Task 1: Define the typed context + middleware

**Files:**

- Create: `apps/api/src/lib/context.ts`
- Create: `apps/api/src/middleware/org.ts`

- [ ] **Step 1: Add a typed Context type**

`apps/api/src/lib/context.ts`:

```typescript
import type { Context } from "hono";

export interface OrgContext {
  userId: string;
  orgId: string;
  orgRole: "owner" | "admin" | "member";
}

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    sessionId?: string;
    orgId?: string;
    orgRole?: "owner" | "admin" | "member";
  }
}

export function getOrgContext(c: Context): OrgContext {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const orgRole = c.get("orgRole");
  if (!userId || !orgId || !orgRole) {
    throw new Error("orgContext not set — apply requireOrgMember() first");
  }
  return { userId, orgId, orgRole };
}
```

- [ ] **Step 2: Implement the middleware**

`apps/api/src/middleware/org.ts`:

```typescript
import type { MiddlewareHandler } from "hono";
import { AppError } from "./error";

/**
 * Requires the caller to be an owner or admin of at least one organization.
 * Stores orgId and orgRole on the Hono context.
 *
 * Apply AFTER authMiddleware. If the user has memberships but none with
 * owner/admin, returns 403. (Mirrors the inline check replaced in
 * audit-2026-06-18 P2-1.)
 */
export const requireOrgMember: MiddlewareHandler = async (c, next) => {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const member = (await c.env.DB.prepare(
    `SELECT org_id, role FROM org_members
     WHERE user_id = ? AND role IN ('owner', 'admin')
     ORDER BY (role = 'owner') DESC, created_at ASC
     LIMIT 1`,
  )
    .bind(userId)
    .first()) as { org_id: string; role: "owner" | "admin" } | null;

  if (!member) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }

  c.set("orgId", member.org_id);
  c.set("orgRole", member.role);
  await next();
};
```

Notes:

- The ORDER BY picks `owner` before `admin` so a user who owns Org A and admins Org B is consistently treated as owning A. Old code returned whichever row LIMIT 1 hit first; this is intentional determinism.
- For products/licenses endpoints, the subsequent `SELECT ... WHERE organization_id = ?` continues to work — `c.get('orgId')` is now the filter value.

## Task 2: Refactor every handler to use the middleware

For each route group below, the change is identical:

1. Add `requireOrgMember` import
2. Apply it on the router via `router.use('/*', requireOrgMember)` AFTER `authMiddleware`
3. In each handler, replace the inline `member = ...` block with `const orgId = c.get('orgId')!;`
4. Keep all `WHERE organization_id = ?` SQLs untouched (they already use the right value)

**Files to edit (router.ts files only, then handler touchups):**

- `apps/api/src/routes/products/router.ts` — add `requireOrgMember` after `authMiddleware`
- `apps/api/src/routes/products/list.ts` — drop the 9-line `SELECT` block, use `c.get('orgId')`
- `apps/api/src/routes/products/get.ts` — same
- `apps/api/src/routes/products/update.ts` — keep BOTH the inline check (used to fetch current product on empty updates) AND the middleware; OR add a `requireOrgMember` and an additional membership check by `id` — see S2
- `apps/api/src/routes/products/create.ts` — drop the inline check, use `c.get('orgId')`
- `apps/api/src/routes/products/delete.ts` — uses owner-only; use `c.get('orgRole')` for the gate
- `apps/api/src/routes/products/api-key.ts` — drop both inline checks; still check role === 'admin' || 'owner' if needed

Same pattern for:

- `routes/licenses/*` (create, list, get, update, revoke, transfer, reset-devices)
- `routes/webhooks/*` (all 8)
- `routes/analytics/*` (all 4)
- `routes/audit-logs/list.ts`
- `routes/devices/deactivate.ts`
- `routes/activations/activate.ts` (uses `org_id` for the license-key flow, not the membership — keep its query as-is for now; we'll wire a thin refactor in S6)

**Skip:**

- `routes/orgs/*` (get, update, delete) — these use the path-param org id, not the caller's "any admin org"
- `routes/orgs/create.ts` — no membership needed
- `routes/activations/activate.ts` public path — keep current behavior; revisit in S5/S6

- [ ] **Step 1: Refactor products router + handlers (template for the rest)**

```typescript
// apps/api/src/routes/products/router.ts
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMember } from "../../middleware/org";
// ...handler imports

export const productsRouter = new Hono();
productsRouter.use("/*", authMiddleware);
productsRouter.use("/*", requireOrgMember);
// ...routes
```

- [ ] **Step 2: Refactor products/list.ts as the canonical example**

```typescript
// apps/api/src/routes/products/list.ts
import type { Context } from "hono";
import { listProductsSchema } from "@keyra/shared-validation";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProductsHandler(c: Context) {
  const orgId = c.get("orgId"); // set by requireOrgMember
  if (!orgId) throw new Error("orgId missing — middleware misconfigured");

  const query = c.req.query();
  const parsed = listProductsSchema.safeParse(query);
  if (!parsed.success) throw parsed.error;
  const { limit, cursor } = parsed.data;

  let sql = `SELECT id, name, description, created_at, updated_at FROM products WHERE organization_id = ?`;
  const params: unknown[] = [orgId];
  if (cursor) {
    sql += ` AND id < ?`;
    params.push(cursor);
  }
  sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit + 1);

  const result = await c.env.DB.prepare(sql)
    .bind(...params)
    .all();
  // ...rest unchanged
}
```

- [ ] **Step 3: Repeat for all 25+ handlers listed above.** Keep diff small; no SQL changes. The goal is line-count reduction, not functional change.

## Task 3: Test the middleware

**Files:**

- Create: `apps/api/src/middleware/__tests__/org.test.ts`

- [ ] **Step 1: Cover happy path + 401 + 403**

```typescript
// apps/api/src/middleware/__tests__/org.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { requireOrgMember } from "../org";
import { authMiddleware } from "../auth";
import { errorHandler } from "../error";

function createMockContext() {
  const prepare = vi.fn();
  return {
    env: { DB: { prepare } },
    req: { header: vi.fn() },
    executionCtx: { waitUntil: vi.fn() },
    set: vi.fn(),
    get: vi.fn(),
    json: vi.fn(),
  } as any;
}

describe("requireOrgMember middleware", () => {
  it("returns 401 when userId missing", async () => {
    const app = new Hono();
    app.use("/*", async (c, next) => {
      await next();
    });
    app.use("/*", requireOrgMember);
    app.onError(errorHandler);
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.status).toBe(500); // c.get('userId') is undefined → throws
  });

  it("sets orgId and orgRole on context when membership exists", async () => {
    let captured: any = {};
    const app = new Hono();
    app.use("/*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.use("/*", requireOrgMember);
    app.get("/", (c) => {
      captured = { orgId: c.get("orgId"), orgRole: c.get("orgRole") };
      return c.json({ ok: true });
    });
    (app as any).env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ org_id: "o1", role: "admin" }),
          }),
        }),
      },
    };

    await app.request("/");
    expect(captured.orgId).toBe("o1");
    expect(captured.orgRole).toBe("admin");
  });

  it("returns 403 when no admin/owner membership", async () => {
    const app = new Hono();
    app.use("/*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.use("/*", requireOrgMember);
    app.onError(errorHandler);
    app.get("/", (c) => c.json({ ok: true }));
    (app as any).env = {
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) },
    };

    const res = await app.request("/");
    expect(res.status).toBe(403);
  });
});
```

## Verification

```bash
./init.sh quick
```

Expect: typecheck OK; lint OK; all existing tests pass; new `org.test.ts` 3 tests pass.

## Acceptance

- [ ] Zero occurrences of `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin')` in `apps/api/src/routes/**` (only `middleware/org.ts` should have it).
- [ ] All protected handlers read `c.get('orgId')` instead of running inline SQL.
- [ ] Three new middleware tests pass.
- [ ] All previous tests pass without modification (except minor mock-context updates if your mocks passed `c.json` to the wrong signature).

## Rollback

```bash
git revert <s1-commit>
```

Middleware is additive — handlers can keep both the inline check and `c.get('orgId')` reading.

## Closes

- **P2-1** — duplicated admin-membership SQL.
- **Unlocks S2 and S3** (org-filter fixes become one-line).

## Migration helper (for follow-on plans)

The middleware sets `orgId` AND `orgRole`. S2 and S3 require the additional check `WHERE organization_id = c.get('orgId')` on the affected `UPDATE` statements. That's the only delta they need.

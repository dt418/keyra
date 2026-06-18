# S6 — Verify / Activate Response Scope Reduction

> Closes: **P0-8** (verify response leaks `feature_flags` / `license_id` / `product_name` / `expires_at`).

## Goal

The public `POST /api/v1/verify` endpoint currently returns a rich object including `feature_flags` and `license_id` on success. These should be limited to what a customer SDK actually needs. Introduce a server-side distinction between two response shapes:
- **Public/SDK response** (no auth): `valid`, `expires_at`, `product_id`, `license_type`. No `license_id`, no `feature_flags`.
- **Authenticated response** (auth required): full object.

`/activate` returns the new device details only — no `feature_flags` echoed back unless authenticated.

## File Structure

```
apps/api/src/routes/verify/
├── index.ts                  # EDIT — strip detail
├── public.ts                 # CREATE — auth-free thin endpoint OR keep in index.ts with no detail
apps/api/src/routes/activations/
├── activate.ts               # EDIT — strip feature_flags from response
```

---

## Task 1: Trim /verify response

**Files:**
- Edit: `apps/api/src/routes/verify/index.ts`

- [ ] **Step 1: Read the current response shape**

Open `apps/api/src/routes/verify/index.ts:75-92`. The success response currently returns `license_id`, `product_name`, `license_type`, `feature_flags`, `expires_at`. Replace with:

```typescript
return c.json({
  data: {
    valid: true,
    expires_at: license.expires_at,
    product_id: license.product_id,
    license_type: license.type,
  },
});
```

- [ ] **Step 2: Keep the failure shape unchanged**

`{ valid: false, reason }` is fine and should stay.

- [ ] **Step 3: Update the e2e + dashboard if they consume the rich fields**

Search for callers of `/verify` and `verifyApi` in `apps/dashboard/` and `apps/api/e2e/`. If they use `feature_flags` or `license_id`, switch them to the authenticated `/licenses/:id` endpoint (which requires auth).

## Task 2: Trim /activate response

**Files:**
- Edit: `apps/api/src/routes/activations/activate.ts`

- [ ] **Step 1: Read the response shape**

Find lines around the `return c.json({ ... 201 })` at the end of `activate.ts`. Strip `feature_flags` and any other tenant-business-logic fields from the success response. Keep: `activation_id`, `device_id`, `expires_at`, `license_type`.

- [ ] **Step 2: Confirm the SDK can still verify**

The SDK is a customer-installed module. Its only public surface is the verify/activate endpoints. The trimmed response is sufficient for "is the license valid, when does it expire, what tier". The SDK can later fetch full details via a separate authenticated channel if needed.

## Task 3: Tests

**Files:**
- Edit: `apps/api/src/routes/verify/__tests__/*.test.ts` (create if absent)
- Edit: `apps/api/src/routes/activations/__tests__/handlers.test.ts`

- [ ] **Step 1: Verify response shape**

```typescript
it('verify response contains only valid, expires_at, product_id, license_type', async () => {
  // ...mock license lookup, call endpoint
  const body = await res.json();
  expect(body.data).toEqual({
    valid: true,
    expires_at: '...',
    product_id: '...',
    license_type: '...',
  });
  expect(body.data.feature_flags).toBeUndefined();
  expect(body.data.license_id).toBeUndefined();
});
```

- [ ] **Step 2: Activate response does not leak feature_flags**

```typescript
it('activate response does not include feature_flags', async () => {
  // call /activate, expect body.data not to have feature_flags
});
```

## Verification

```bash
./init.sh quick
```

## Acceptance

- [ ] `/verify` success body has no `license_id`, no `feature_flags`, no `product_name`.
- [ ] `/activate` success body has no `feature_flags`.
- [ ] All SDK callers still work (SDK only consumes `valid` + `expires_at` + `license_type`).
- [ ] Dashboard callers that relied on the rich fields are routed through authenticated endpoints.

## Rollback

```bash
git revert <s6-commit>
```

## Closes

- **P0-8** — `/verify` response leaks tenant business logic.

## Out of scope

- A separate "verify + full details" authenticated endpoint. Add in a follow-up.
- Server-side license activation throttling (separate from S5). Could be `10/min/license_key`.

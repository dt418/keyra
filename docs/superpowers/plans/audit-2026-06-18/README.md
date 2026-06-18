# Audit 2026-06-18 — Security Hardening Plans (S0–S7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan set plan-by-plan. Each plan is self-contained and can be executed independently. Steps use checkbox (`- [ ]`) syntax for tracking.

**Source audit:** see `docs/superpowers/specs/2026-06-18-keyra-security-audit.md` (or session-handoff if spec not present).

**Goal:** Close all P0 and P1 security findings from the 2026-06-18 audit. The 8 plans fix multi-tenant IDORs, OAuth account takeover, committed secrets, public-endpoint abuse, and auth/rate-limit gaps. After this set, the API is safe to expose to real users.

**Architecture:** Cloudflare Workers (Hono) + D1 (SQLite) + KV. No infra changes; only code + .env hygiene + tests.

**Tech Stack:** pnpm, Turborepo, Hono, jose, zod, bcryptjs, D1, KV, Vitest, Playwright, wrangler.

---

## Plan order (suggested)

| #   | Plan                                    | Theme                                                                            | Depends on | Effort |
| --- | --------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------ |
| S0  | `s0-secret-rotation-and-env-hygiene.md` | Remove committed secrets                                                         | —          | S      |
| S1  | `s1-org-membership-middleware.md`       | `requireOrgMember` middleware (replaces 31x copy-paste)                          | —          | M      |
| S2  | `s2-products-idor-fix.md`               | PATCH /products/:id org-filter IDOR                                              | S1         | S      |
| S3  | `s3-licenses-transfer-idor-fix.md`      | POST /licenses/:id/transfer org-filter + target-org ownership                    | S1         | S      |
| S4  | `s4-oauth-hardening.md`                 | State required, account-link by email → bind or error, unified storeRefreshToken | —          | S      |
| S5  | `s5-public-endpoints-rate-limit.md`     | Per-endpoint rate limit on /verify, /activate, /auth/refresh                     | S0         | M      |
| S6  | `s6-verify-activate-scope-reduction.md` | Trim /verify response (no feature_flags, no license_id if invalid)               | —          | S      |
| S7  | `s7-auth-flow-hygiene.md`               | Login timing-safe, register email_verified default 0, OAuth redirect_uri guard   | —          | S      |

**Sequencing rule:** S0 first (rotation). S1 unlocks S2 and S3. S4 + S5 + S6 + S7 can run in parallel.

**Total:** 7 distinct plans covering 9 P0 and 7 P1 findings. All verification via `./init.sh quick` after each plan.

---

## Per-plan shape

Each plan follows the same skeleton:

1. **File Structure** — exact files to create/edit
2. **Task list** — 3-6 tasks, each with checkbox steps
3. **Each Task** — Goal, Files, Steps with code blocks, Verification
4. **Acceptance** — explicit pass criteria + which audit findings it closes
5. **Rollback** — how to revert if a step fails

## Critical-rules from AGENTS.md (do not violate)

- API responses are snake_case. Handlers stay snake_case; the type layer is camelCase only.
- Never add files at project root.
- Auth middleware returns Response, does not throw (tests must read `await result.json()`).
- Throw `AppError(code, message, status)` from `@/middleware/error`. Do not bypass with `c.json({error}, code)`.
- Theme storage key is `keyra-ui-theme` (unchanged).
- No new dependencies unless explicitly required.
- `./init.sh quick` must pass before claiming done.

## Files conventions

- Handler exports `export async function <verb><Resource>Handler(c: Context)`.
- zod schemas live in `packages/shared-validation/src/<resource>.ts`; import via `@keyra/shared-validation`.
- Errors via `throw new AppError(...)`; only `c.json` for success responses.
- Use `c.env.DB.prepare(sql).bind(...).first()/.all()/.run()`; never string-interpolate SQL.
- Tests live in `<resource>/__tests__/<verb>.test.ts` using `vitest --run`.

## Shared verification (run after every plan)

```bash
# from repo root
./init.sh quick
```

Expected: typecheck OK, lint OK, all unit tests pass. If any plan breaks existing tests, fix them before moving on.

## Out of scope (deferred to other plan sets)

- Architecture cleanup (org-membership middleware is the only refactor here)
- Test/DX gaps (T-set plans)
- Frontend polish (F-set plans)
- Direction features (D-set plans)
- License-key modulo bias (P2-3) — accepted as cosmetic
- OFFSET pagination (P2-4) — accepted; keyset cursor deferred to A-set

## Audit-trail rule (from CLAUDE.md / AGENTS.md)

After every plan, run `scripts/ship-phase.sh "<plan-id>: <one-line summary>"` if the gates pass. Do not amend or skip CI.

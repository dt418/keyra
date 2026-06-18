# Session Handoff — audit-2026-06-18 Security Hardening

## Current Objective

- **Goal:** Land all 8 audit plans (S0–S7) that close 9 P0 + 7 P1 security findings from the 2026-06-18 audit. Each plan = one feature (feat-019..feat-026) = one commit via `scripts/ship-phase.sh`.
- **Current status:** Sync done. feat-019 (S0) next to implement.
- **Branch / commit:** main, sync commit pending

## Findings (from docs/superpowers/specs/2026-06-18-keyra-security-audit.md or session notes)

| Severity | ID | Summary |
|----------|----|---------|
| P0 | P0-1 | PATCH /products/:id cross-tenant write (no org filter on UPDATE) |
| P0 | P0-2 | POST /licenses/:id/transfer cross-tenant write + target-org takeover |
| P0 | P0-3 | OAuth account takeover by email (no provider binding) |
| P0 | P0-4 | OAuth state validation optional |
| P0 | P0-5 | OAuth callback local storeRefreshToken skips KV (logout ineffective) |
| P0 | P0-6 | Committed secrets in apps/api/.dev.vars |
| P0 | P0-7 | /verify + /activate no rate limit |
| P0 | P0-8 | /verify response leaks feature_flags + license_id |
| P0 | P0-9 | (covered by P0-7 in current S5 plan) |
| P1 | P1-1..P1-7 | Various — see plans S5, S7 |

## Completed This Session

- [x] Audit completed; 8 self-contained plans in `docs/superpowers/plans/audit-2026-06-18/`
- [x] feat-019..feat-026 added to `feature_list.json` with dependencies + plan links
- [x] progress.md updated to audit phase

## Plan → Feature map

| Plan | Feature | Closes | Depends on |
|------|---------|--------|-----------|
| S0  | feat-019 | P0-6  | — |
| S1  | feat-020 | P2-1  | — |
| S2  | feat-021 | P0-1  | S1 |
| S3  | feat-022 | P0-2  | S1 |
| S4  | feat-023 | P0-3, P0-4, P0-5, P1-7 | — |
| S5  | feat-024 | P0-7, P1-8, P1-9 | S0 |
| S6  | feat-025 | P0-8  | — |
| S7  | feat-026 | P1-1, P1-2, P1-3, P1-5 | — |

## Verification Evidence

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| feature_list parses | `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8'))"` | PASS | 26 features (18 prior + 8 audit) |
| Sync commit | `git commit -m "chore: sync audit-2026-06-18 plans into harness"` | pending | ship immediately after this handoff |
| init.sh quick post-S0 | `./init.sh quick` | pending | after S0 implementation |
| init.sh quick post-S7 | `./init.sh quick` | pending | after last plan ships |

## Next Session Startup

1. Run `./init.sh quick` — must be green.
2. Read `feature_list.json` — pick the first `not-started` audit feature in dependency order (S0 → S1 → S2/S3 → S4/S5/S6/S7).
3. Read the corresponding `docs/superpowers/plans/audit-2026-06-18/sN-*.md` plan.
4. Implement; run `./init.sh quick` after each task.
5. When green: `scripts/ship-phase.sh "feat-019: S0 secret rotation"` (substitute plan id).
6. Update `feature_list.json` evidence + `progress.md` with one-line evidence per plan.

## Recommended Next Step

- Implement feat-019 (S0 — Secret Rotation). The plan is straightforward: scrub `.dev.vars`, add `.gitignore` + `.env.example`, write `scripts/check-secrets.sh`, wire to lefthook. No code-logic changes; safe first commit.

---

# Session Handoff — feat-017 React Hook Form Integration (DONE 2026-06-16)

## Outcome

- 28 shared-validation form schema tests + 62 dashboard tests + 38 e2e pass
- Edit Product dialog migrated to RHF + zodResolver
- shadcn primitives: Calendar, Checkbox (base-ui), Combobox, Field, RadioGroup, Switch
- DateField uses Calendar in Popover
- Login/register migration deferred to a follow-up feature

## Open follow-up

- Migrate remaining 4 forms (Create Product, Create/Edit Org, Create/Edit License, Create Webhook) to the new RHF primitives — out of scope for feat-017 (Edit Product was the proof)
- Migrate login/register (auth) to RHF — separate feature
- Tighten form primitive tests (e.g. error-state coverage in form-field test #2)
- Add a base-ui/slot ref forwarding to Button so PopoverTrigger stops warning (DONE in 5e7f079)

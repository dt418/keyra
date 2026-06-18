# S0 — Secret Rotation & Env Hygiene

> Closes: **P0-6** (committed secrets in `apps/api/.dev.vars`).

## Goal

Remove live credentials from the repo. Rotate the JWT secrets and the Cloudflare API token. Add a `.gitignore` entry, an `.env.example`, and a secret-scanning hook. Update CI/dev to read from `wrangler secret put` / local `.dev.vars` (git-ignored).

## File Structure

```
apps/api/
├── .dev.vars                      # EDIT — wipe real values; replace with placeholders
├── .gitignore                     # CREATE — ignore .dev.vars
├── .env.example                   # CREATE — public surface of required vars
└── wrangler.jsonc                 # UNCHANGED (already declares D1 + KV)

.github/
└── workflows/
    └── ci.yml                     # UNCHANGED (no real secrets used)

.gitignore                          # EDIT — add `.dev.vars` repo-wide
scripts/
└── check-secrets.sh               # CREATE — grep-based pre-commit guard
```

---

## Task 1: Rotate JWT secrets and Cloudflare token

**Files:**

- (Cloudflare dashboard)
- `apps/api/.dev.vars` (edit)
- (production secret store)

- [ ] **Step 1: Generate new secrets locally**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # JWT_REFRESH_SECRET
```

Save outputs to a password manager; do not paste into this repo.

- [ ] **Step 2: Rotate production secrets in Cloudflare**

```bash
# for each env (staging + production if both exist)
cd apps/api
echo "<new-JWT-SECRET>" | wrangler secret put JWT_SECRET
echo "<new-JWT-REFRESH-SECRET>" | wrangler secret put JWT_REFRESH_SECRET
```

Document the new `CLOUDFLARE_API_TOKEN` rotation separately; the audit recommendation is to create a fresh scoped token (D1 read/write + KV read/write only, not the global account token).

- [ ] **Step 3: Replace `apps/api/.dev.vars` with placeholders**

```bash
cat > apps/api/.dev.vars <<'EOF'
# Local development secrets — DO NOT COMMIT REAL VALUES
# Get these from your password manager after running scripts/rotate-secrets.sh
JWT_SECRET=<paste-from-1password>
JWT_REFRESH_SECRET=<paste-from-1password>
CLOUDFLARE_API_TOKEN=<paste-from-1password>
CLOUDFLARE_ACCOUNT_ID=eb83fb3549b03c0a18071e94ddf42f92
D1_DATABASE_ID=e2adcab2-65f0-41b2-8c09-56c18f8da262
SESSIONS_KV_ID=a5a762f9abea41678f39c59d151b883e
ENVIRONMENT=development
DISABLE_RATE_LIMIT=1
EOF
```

The committed file now contains placeholders. The real file lives on each developer's machine and in CI secret store.

## Task 2: Gitignore the secrets

**Files:**

- Edit: `.gitignore` (root)
- Create: `apps/api/.gitignore`

- [ ] **Step 1: Add root-level gitignore entry**

Append to `.gitignore`:

```
# Local secrets
.dev.vars
apps/*/.dev.vars
packages/*/.dev.vars
```

- [ ] **Step 2: Add api-package gitignore**

`apps/api/.gitignore`:

```
.dev.vars
.wrangler/
node_modules/
playwright-report/
test-results/
```

- [ ] **Step 3: Remove the file from the index but keep it locally**

```bash
git rm --cached apps/api/.dev.vars
git commit -m "chore(security): untrack apps/api/.dev.vars after S0"
```

If git refuses due to secrets, use `git filter-repo` (or BFG) to scrub from history. Recommended: at minimum, scrub the last 30 commits; document the rotation in `progress.md` and notify the team.

## Task 3: Public env surface

**Files:**

- Create: `apps/api/.env.example`

- [ ] **Step 1: List all required env vars**

`apps/api/.env.example`:

```
# Keyra API — required env vars for local dev / wrangler
# Real values live in .dev.vars (git-ignored) and in `wrangler secret put`

# JWT
JWT_SECRET=                              # 32 random bytes, base64
JWT_REFRESH_SECRET=                      # 32 random bytes, base64

# Cloudflare (D1 + KV)
CLOUDFLARE_ACCOUNT_ID=
D1_DATABASE_ID=
SESSIONS_KV_ID=

# OAuth
OAUTH_REDIRECT_URI=http://localhost:8788/api/v1/auth/oauth/callback
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=

# Runtime
ENVIRONMENT=development
DISABLE_RATE_LIMIT=1                     # 1 in dev to keep e2e fast
```

## Task 4: Secret-scanning pre-commit hook

**Files:**

- Create: `scripts/check-secrets.sh`
- Edit: `lefthook.yml` (add pre-commit hook)

- [ ] **Step 1: Write the scanner**

`scripts/check-secrets.sh`:

```bash
#!/usr/bin/env bash
# check-secrets.sh — fail if known secret patterns appear in staged changes
set -euo pipefail
STAGED=$(git diff --cached --unified=0 --no-color | grep -E '^\+' || true)
PATTERNS=(
  'AKIA[0-9A-Z]{16}'                         # AWS
  'whsec_[A-Za-z0-9]{20,}'                   # webhook-style
  'sk_(live|test)_[A-Za-z0-9]{20,}'          # stripe
  'gh[pousr]_[A-Za-z0-9]{30,}'               # github
  'cf[a-z]_[A-Za-z0-9_-]{30,}'               # cloudflare api tokens (cfut_, cfsu_, ...)
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' # JWT
)
FAIL=0
for p in "${PATTERNS[@]}"; do
  if echo "$STAGED" | grep -E "$p" >/dev/null; then
    echo "check-secrets: matched pattern $p"
    FAIL=1
  fi
done
exit $FAIL
```

```bash
chmod +x scripts/check-secrets.sh
```

- [ ] **Step 2: Wire into lefthook**

Append to `lefthook.yml`:

```yaml
pre-commit:
  commands:
    secret-scan:
      glob: "*"
      run: scripts/check-secrets.sh
```

## Verification

```bash
./init.sh quick
```

Expect: typecheck, lint, unit tests all pass. Local dev still boots because `.dev.vars` exists locally with placeholders + the dev still sets real values via password manager (or `wrangler secret put` + `.dev.vars` shim).

## Acceptance

- [ ] `apps/api/.dev.vars` in repo contains ONLY placeholders or the public `D1_DATABASE_ID` / `SESSIONS_KV_ID` / `CLOUDFLARE_ACCOUNT_ID` values.
- [ ] `git log -- apps/api/.dev.vars` shows the untrack commit; previous commits' secrets are rotated and (ideally) scrubbed.
- [ ] `scripts/check-secrets.sh` runs on pre-commit and exits non-zero on test fixtures that contain `AKIA...` / `whsec_...` / `cfut_...` patterns.
- [ ] All existing tests still pass.

## Rollback

```bash
git revert <rotate-commit>
# restore the old .dev.vars from the previous commit (still in history pre-scrub)
```

## Closes

- **P0-6** — committed secrets in `apps/api/.dev.vars`.

#!/usr/bin/env bash
# scripts/sync-secrets.sh
# Syncs apps/api/.dev.vars values to Cloudflare Workers (wrangler secret put)
# and to GitHub Actions (gh secret set / gh variable set). Never echoes values.
#
# Run from repo root:  ./scripts/sync-secrets.sh
# Requires: wrangler (in PATH, already authed), gh (in PATH, already authed).
# Requires: apps/api/.dev.vars with real values (the file is gitignored).
#
# Variables (CORS_ALLOWED_ORIGINS, VITE_API_URL) are pushed via `gh variable set`
# and `wrangler deploy --var` — not `secret put` — because they're not sensitive
# and must be readable at build time (VITE_API_URL) / wrangler-action deploy time.

set -euo pipefail
cd "$(dirname "$0")/.."

read_secret() {
  local key="$1"
  grep "^${key}=" apps/api/.dev.vars | cut -d= -f2-
}

if [ ! -f apps/api/.dev.vars ]; then
  echo "✗ apps/api/.dev.vars not found. Copy from .env.example and fill real values." >&2
  exit 1
fi

# Required: real values must be present
for k in JWT_SECRET JWT_REFRESH_SECRET; do
  v=$(read_secret "$k" || true)
  if [ -z "$v" ] || [[ "$v" == \<* ]]; then
    echo "✗ $k missing or still a placeholder in apps/api/.dev.vars" >&2
    exit 1
  fi
done

# Optional: only sync if present + non-placeholder
sync_secret() {
  local k="$1"
  local v
  v=$(read_secret "$k" || true)
  if [ -z "$v" ] || [[ "$v" == \<* ]]; then
    echo "⊘ $k skipped (not set in .dev.vars)"
    return 0
  fi
  echo "→ wrangler secret put $k"
  printf '%s' "$v" | (cd apps/api && wrangler secret put "$k") >/dev/null
  echo "→ gh secret set $k"
  printf '%s' "$v" | gh secret set "$k" -R dt418/keyra >/dev/null
  echo "✓ $k synced to wrangler + github"
}

# Vars (non-sensitive, read at build / deploy time). CORS_ALLOWED_ORIGINS is
# also injected at deploy time via wrangler-action `vars:` input in deploy.yml;
# setting it as a GH secret here lets `wrangler dev` read it locally too.
sync_var() {
  local k="$1"
  local v
  v=$(read_secret "$k" || true)
  if [ -z "$v" ] || [[ "$v" == \<* ]]; then
    echo "⊘ $k skipped (not set in .dev.vars)"
    return 0
  fi
  echo "→ gh variable set $k"
  printf '%s' "$v" | gh variable set "$k" -R dt418/keyra >/dev/null
  echo "✓ $k synced to github vars (consumed by dashboard build / api deploy)"
}

echo "=== Required secrets ==="
sync_secret JWT_SECRET
sync_secret JWT_REFRESH_SECRET

echo ""
echo "=== Optional secrets ==="
sync_secret OAUTH_REDIRECT_URI
sync_secret OAUTH_GOOGLE_CLIENT_ID
sync_secret OAUTH_GOOGLE_CLIENT_SECRET
sync_secret OAUTH_GITHUB_CLIENT_ID
sync_secret OAUTH_GITHUB_CLIENT_SECRET
sync_secret CLOUDFLARE_API_TOKEN
sync_secret CLOUDFLARE_ACCOUNT_ID

echo ""
echo "=== Variables (non-sensitive, build-time / deploy-time) ==="
sync_var CORS_ALLOWED_ORIGINS
sync_var VITE_API_URL

echo ""
echo "Done. Verify with:"
echo "  gh secret   list -R dt418/keyra | grep -E 'JWT_SECRET|JWT_REFRESH_SECRET'"
echo "  gh variable list -R dt418/keyra | grep -E 'CORS_ALLOWED_ORIGINS|VITE_API_URL'"
echo "  (cd apps/api && wrangler secret list)"

#!/usr/bin/env bash
# scripts/sync-secrets.sh
# Pushes local apps/api/.dev.vars values to Cloudflare Workers (wrangler secret put)
# and to GitHub Actions (gh secret set). Never echoes values.
#
# Run from repo root:  ./scripts/sync-secrets.sh
# Requires: wrangler (in PATH, already authed), gh (in PATH, already authed).
# Requires: apps/api/.dev.vars with real values (the file is gitignored).

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

echo "=== Required ==="
sync_secret JWT_SECRET
sync_secret JWT_REFRESH_SECRET

echo ""
echo "=== Optional (skipped if missing) ==="
sync_secret OAUTH_REDIRECT_URI
sync_secret OAUTH_GOOGLE_CLIENT_ID
sync_secret OAUTH_GOOGLE_CLIENT_SECRET
sync_secret OAUTH_GITHUB_CLIENT_ID
sync_secret OAUTH_GITHUB_CLIENT_SECRET
sync_secret CLOUDFLARE_API_TOKEN

echo ""
echo "Done. Verify with:"
echo "  gh secret list -R dt418/keyra | grep -E 'JWT_SECRET|JWT_REFRESH_SECRET'"
echo "  (cd apps/api && wrangler secret list)"

#!/usr/bin/env bash
# init.sh — Keyra harness bootstrap
# Runs the verification pipeline a coding agent must pass before claiming
# any feature is done. Exit non-zero on any failure.
#
# Usage:  ./init.sh [quick|full]
#   quick (default) — install, typecheck, lint, unit tests
#   full            — quick + build + e2e (auto-migrates local D1)
set -euo pipefail
export CI=1
MODE="${1:-quick}"
cd "$(dirname "$0")"

echo "=== Keyra harness init (mode=$MODE) ==="
echo "Node: $(node -v)  Pnpm: $(pnpm -v 2>/dev/null || echo 'missing')"

echo "--- install ---"
pnpm install --frozen-lockfile

echo "--- typecheck ---"
pnpm typecheck

echo "--- lint ---"
pnpm lint

echo "--- unit tests ---"
pnpm test

if [ "$MODE" = "full" ]; then
  echo "--- build ---"
  pnpm build

  echo "--- e2e (auto-migrates local D1) ---"
  rm -rf apps/api/.wrangler/state
  nohup pnpm --filter @keyra/api dev > /tmp/wrangler-init.log 2>&1 &
  DEV_PID=$!
  trap 'kill -9 $DEV_PID 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    if curl -sf -m 1 http://localhost:8788/ >/dev/null 2>&1 \
       || curl -s -m 1 http://localhost:8788/ 2>&1 | grep -q "404\|ready"; then
      break
    fi
    sleep 1
  done
  pnpm --filter @keyra/api test:e2e
  kill -9 $DEV_PID 2>/dev/null || true
  trap - EXIT
fi

echo ""
echo "=== Verification complete ==="
echo "Next:"
echo "  1. Read feature_list.json — pick ONE not-started or in-progress feature"
echo "  2. Read AGENTS.md for project rules"
echo "  3. Implement only that feature"
echo "  4. Re-run ./init.sh quick; record evidence in feature_list.json"
echo "  5. Update progress.md; commit clean state"

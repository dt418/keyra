#!/usr/bin/env bash
# ship-phase.sh — gates → commit → push, end-of-phase automation
# Usage: scripts/ship-phase.sh "<commit-message>"
#
# Exits non-zero on any gate failure so CI/blocking agents can react.

set -euo pipefail

MSG="${1:-chore: ship phase}"

echo "== typecheck =="
pnpm typecheck

echo "== lint =="
pnpm lint

echo "== api unit =="
pnpm --filter @keyra/api test

echo "== dashboard unit =="
pnpm --filter @keyra/dashboard test

echo "== e2e (auto-migrates local D1) =="
rm -rf apps/api/.wrangler/state
nohup pnpm --filter @keyra/api dev > /tmp/wrangler-ship.log 2>&1 &
DEV_PID=$!
trap 'kill -9 $DEV_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -sf -m 1 http://localhost:8788/ >/dev/null 2>&1 || curl -s -m 1 http://localhost:8788/ 2>&1 | grep -q "404\|ready"; then
    break
  fi
  sleep 1
done
pnpm --filter @keyra/api test:e2e
kill -9 $DEV_PID 2>/dev/null || true
trap - EXIT

if [[ -n "$(git status --porcelain)" ]]; then
  echo "== commit =="
  git add -A
  git commit -m "$MSG"
fi

echo "== push =="
git push origin HEAD

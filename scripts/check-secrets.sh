#!/usr/bin/env bash
# check-secrets.sh — fail if known secret patterns appear in staged changes
# Wired as a lefthook pre-commit hook. Exits non-zero on hit.
set -euo pipefail

STAGED=$(git diff --cached --unified=0 --no-color | grep -E '^\+' || true)

PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'whsec_[A-Za-z0-9]{20,}'
  'sk_(live|test)_[A-Za-z0-9]{20,}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'cf[a-z]_[A-Za-z0-9_-]{30,}'
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
)

FAIL=0
for p in "${PATTERNS[@]}"; do
  if echo "$STAGED" | grep -E "$p" >/dev/null 2>&1; then
    echo "check-secrets: matched pattern $p"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "Refusing to commit: secret-like pattern found in staged changes."
  echo "If this is a placeholder (e.g. <paste-from-1password>), no real secret is in the diff."
  echo "If a real secret is staged, rotate it BEFORE committing (see scripts/rotate-secrets.sh)."
  exit 1
fi

exit 0

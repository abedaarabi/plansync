#!/bin/sh
# Retry npm ci during Docker builds — registry.npmjs.org can drop connections (ECONNRESET).
set -eu

MAX_ATTEMPTS="${NPM_CI_ATTEMPTS:-5}"
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if npm ci "$@"; then
    exit 0
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "npm ci failed after ${MAX_ATTEMPTS} attempts" >&2
    exit 1
  fi

  wait=$((attempt * 10))
  echo "npm ci failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${wait}s..." >&2
  sleep "$wait"
  attempt=$((attempt + 1))
done

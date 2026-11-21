#!/usr/bin/env bash
# Runs every check quietly and prints one line per step. Shows the log only for failures.
set -u
fail=0
log_dir=$(mktemp -d)
step() {
  local name=$1; shift
  if "$@" >"$log_dir/$name.log" 2>&1; then
    printf 'PASS  %s\n' "$name"
  else
    printf 'FAIL  %s\n' "$name"; tail -40 "$log_dir/$name.log"; fail=1
  fi
}
step lint      npx eslint . --max-warnings 0
step typecheck npx tsc --noEmit
step test      npx vitest run --reporter=dot
step build     npx tsdown --logLevel error
step size      npx size-limit
step package   sh -c 'npx publint --strict && npx attw --pack . --profile esm-only'
step demo      npx vite build demo --logLevel error
rm -rf "$log_dir"
exit $fail

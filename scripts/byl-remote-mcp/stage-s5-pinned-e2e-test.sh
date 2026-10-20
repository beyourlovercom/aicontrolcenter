#!/usr/bin/env bash
# AICC S5 — isolated, non-installing cross-PR pinned integration test.
# Never merge, cherry-pick, install, sign real keys, or access Agent services.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
stage="$(mktemp -d "${TMPDIR:-/tmp}/aicc-s5-e2e.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
base="scripts/byl-remote-mcp"
s2="1a9fb3891368be5027ca98556086264d1c39f47a"
s3="23cfcf26a006b8a804c71b39bba195599cb1a727"
s4="15464cdf941be107558cda8ad0f5720a94ce44b2"
for pair in "91:$s2" "92:$s3" "93:$s4"; do
  pr="${pair%%:*}"; expected="${pair#*:}"
  git fetch --quiet --no-tags --depth=1 origin "refs/pull/$pr/head"
  actual="$(git rev-parse FETCH_HEAD)"
  if [[ "$actual" != "$expected" ]]; then
    printf 'BLOCKED: PR #%s HEAD drift, expected=%s actual=%s\n' "$pr" "$expected" "$actual" >&2
    exit 77
  fi
  printf 'PIN_OK_PR_%s=%s\n' "$pr" "$actual"
done
# Copy pinned source versions to disposable local folder, no branches merged.
for file in remote-v2-signed-health.mjs remote-v2-live-health.mjs remote-v2-verified-availability.mjs; do
  cp "$base/$file" "$stage/$file"
done
git show "$s2:$base/remote-v2-health-wire-dev.mjs" > "$stage/remote-v2-health-wire-dev.mjs"
git show "$s3:$base/remote-v3-trust-enrollment.mjs" > "$stage/remote-v3-trust-enrollment.mjs"
git show "$s4:$base/remote-v4-agent-signed-health-handler.mjs" > "$stage/remote-v4-agent-signed-health-handler.mjs"
cp "$base/remote-v5-four-device-e2e.test.mjs" "$stage/remote-v5-four-device-e2e.test.mjs"
node --test "$stage/remote-v5-four-device-e2e.test.mjs"
printf 'S5_MODE=TEST_ONLY_LOCAL_LOOPBACK\n'
printf 'S5_PRODUCTION_AGENT_DEPLOYED=NO\n'
printf 'S5_REAL_TRUST_ENROLLED=NO\n'
printf 'S5_BASE_SOURCE_HEAD=%s\n' "$(git rev-parse HEAD)"

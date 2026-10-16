#!/usr/bin/env bash
# Isolated GitHub-runner Agent SOURCE artifact; never install/restart live services.
set -euo pipefail
die(){ printf 'AICC_AGENT_RELEASE_SOURCE_DENIED:%s\n' "$1" >&2; exit 2; }
[[ "$#" -eq 1 ]] || die "ONE_OUTPUT_DIR_REQUIRED"
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || die "GITHUB_SHA_REQUIRED"
[[ "${RUNNER_OS:-}" == Linux ]] || die "GITHUB_HOSTED_LINUX_ONLY"
[[ -n "${RUNNER_TEMP:-}" && -d "${RUNNER_TEMP}" ]] || die "RUNNER_TEMP_REQUIRED"
root="$(git rev-parse --show-toplevel)"
[[ "$(git -C "$root" rev-parse HEAD)" == "$GITHUB_SHA" ]] || die "CHECKOUT_COMMIT_MISMATCH"
out="$1"
[[ "$out" = "${RUNNER_TEMP%/}/"* ]] || die "UNSAFE_OUTPUT_LOCATION"
[[ ! -e "$out" && ! -L "$out" ]] || die "OUTPUT_ALREADY_EXISTS"
mkdir "$out"
mkdir "$out/staging"

# Existing public GitHub package dependency versions and integrity-locked graph.
# A dependency update must separately pass source review before these change.
[[ "$(git -C "$root" hash-object scripts/byl-remote-mcp/package.json)" == 5692e581c17eac6e477b6e1b46549a38940fdd0f ]] \
  || die "PACKAGE_DECLARATION_DRIFT"
[[ "$(git -C "$root" hash-object scripts/byl-remote-mcp/package-lock.json)" == 16d583bea3a56573482cc6ba994a1db090e9af59 ]] \
  || die "PACKAGE_LOCK_DRIFT"

for name in agent-core.mjs agent-entry.mjs; do
  source="$root/scripts/byl-remote-mcp/agent-release-v1/$name"
  [[ -f "$source" && ! -L "$source" ]] || die "PUBLIC_AGENT_SOURCE_MISSING"
  cp "$source" "$out/staging/$name"
done
for name in package.json package-lock.json; do
  cp "$root/scripts/byl-remote-mcp/$name" "$out/staging/$name"
done

# Versioned V1 candidate manifest intentionally never asserts running identity.
node "$root/scripts/byl-remote-mcp/agent-versioned-release.mjs" build \
  "$out/staging" "$out/offline-bundle" us-macmini \
  "$GITHUB_SHA" "$GITHUB_SHA" aicc-agent-source-v1 > /dev/null
node "$root/scripts/byl-remote-mcp/agent-versioned-release.mjs" verify \
  "$out/offline-bundle" > /dev/null

# SDK may be installed in the isolated staging directory, NEVER into signed bundle.
(cd "$out/staging" &&
  npm ci --ignore-scripts --omit=dev --no-fund --no-audit --silent &&
  node --check agent-core.mjs &&
  node --check agent-entry.mjs &&
  node --input-type=module -e "import('./agent-entry.mjs').then(m => { if(typeof m.startApprovedAgent !== 'function') process.exit(3); console.log('ISOLATED_RUNTIME_IMPORT=PASS'); })")

tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='@0' \
  -cf "$out/aicc-agent-runnable-source.tar" -C "$out/offline-bundle" .
sha256sum "$out/aicc-agent-runnable-source.tar"
printf 'PORTABLE_AGENT_SOURCE_BUNDLE=PASS\n'
printf 'ACTUAL_RUNNING_BUILD_ATTESTED=NO\n'
printf 'OLD_AGENT_ROLLBACK_ATTESTED=NO\n'
printf 'OPERATOR_POLICY_VERIFIED=NO\n'
printf 'AGENT_CANARY=STOP\n'

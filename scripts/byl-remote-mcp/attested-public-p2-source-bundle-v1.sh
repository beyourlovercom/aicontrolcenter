#!/usr/bin/env bash
# GitHub-runner-only source attestation subject builder. NOT an Agent installer.
set -euo pipefail

fail() { printf '%s\n' "PUBLIC_P2_SOURCE_BUNDLE_DENIED:$1" >&2; exit 2; }
[[ "$#" -eq 1 ]] || fail "EXPECTED_ONE_OUTPUT_DIRECTORY"
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail "GITHUB_SHA_REQUIRED"
[[ -n "${RUNNER_TEMP:-}" && -d "${RUNNER_TEMP}" ]] || fail "GITHUB_RUNNER_TEMP_REQUIRED"
[[ "${RUNNER_OS:-}" == "Linux" ]] || fail "LINUX_RUNNER_ONLY"

root="$(git rev-parse --show-toplevel)"
[[ "$(git -C "$root" rev-parse HEAD)" == "$GITHUB_SHA" ]] || fail "CHECKOUT_SHA_MISMATCH"
out="$1"
[[ "$out" = "${RUNNER_TEMP%/}/"* ]] || fail "OUTPUT_OUTSIDE_RUNNER_TEMP"
[[ ! -e "$out" && ! -L "$out" ]] || fail "OUTPUT_ALREADY_EXISTS"

# Only three pinned, public, inert P2 components. This is NOT the installed DC Agent.
names=(
  p2-attested-agent-call.mjs
  p2-agent-snapshot-bridge.mjs
  p2-bounded-mcp-response.mjs
)
blobs=(
  c1b62119ae424821872056d2bb01126a85d72891
  52028248b2b3d46ebc056b78d074319fc958e257
  bcf2eefb12cfb7bdcda1e4fd6743f676bb863bcd
)

mkdir "$out"
mkdir "$out/staging"
for i in "${!names[@]}"; do
  f="$root/scripts/byl-remote-mcp/${names[$i]}"
  [[ -f "$f" && ! -L "$f" ]] || fail "APPROVED_SOURCE_MISSING"
  [[ "$(git hash-object "$f")" == "${blobs[$i]}" ]] || fail "APPROVED_PUBLIC_SOURCE_DRIFT"
  cp "$f" "$out/staging/${names[$i]}"
done

node "$root/scripts/byl-remote-mcp/agent-versioned-release.mjs" build \
  "$out/staging" "$out/offline-bundle" us-macmini \
  "$GITHUB_SHA" "$GITHUB_SHA" aicc-p2-source-v1 >/dev/null
node "$root/scripts/byl-remote-mcp/agent-versioned-release.mjs" verify \
  "$out/offline-bundle" >/dev/null

# GNU tar on GitHub-hosted Linux. Deterministic tar subject bound to GitHub SHA.
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='@0' \
  -cf "$out/aicc-p2-public-source.tar" -C "$out/offline-bundle" .
sha256sum "$out/aicc-p2-public-source.tar"
echo "PUBLIC_COMPONENT_CANDIDATE_ONLY=PASS"
echo "AGENT_RUNTIME_BUILD_ATTESTED=NO"
echo "CURRENT_AGENT_VERSION_ATTESTED=NO"
echo "ROLLBACK_ATTESTED=NO"

#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mode="${1:---dev}"
if [[ "$mode" != "--dev" && "$mode" != "--release" ]]; then echo 'Use --dev or --release' >&2; exit 64; fi
if [[ "$(uname -s)" != "Darwin" ]]; then echo 'macOS required' >&2; exit 69; fi
if ! command -v swiftc >/dev/null || ! command -v codesign >/dev/null; then echo 'Swift and codesign required' >&2; exit 69; fi
if [[ "$mode" == "--release" && -z "${AICC_R2A1_SIGNING_IDENTITY:-}" ]]; then
  echo 'BLOCKED: release requires external Owner-approved code signing identity' >&2; exit 77
fi
out="${AICC_R2A1_OUT:-$(mktemp -d "${TMPDIR:-/tmp/}/aicc-r2a1.XXXXXX")}"; mkdir -p "$out"
app="$out/AICC Agent-only Backup Registration.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Library/LaunchDaemons"
cp Info.plist "$app/Contents/Info.plist"
cp com.aicc.agent-only-backup-registrar.plist "$app/Contents/Library/LaunchDaemons/"
swiftc -parse-as-library -target "$(uname -m)-apple-macos13.0" -O BackupRegistration.swift -o "$app/Contents/MacOS/AICCBackupRegistration"
swiftc -parse-as-library -target "$(uname -m)-apple-macos13.0" -O BackupRegistrarDaemon.swift -o "$app/Contents/MacOS/AICCBackupRegistrarDaemon"
plutil -lint "$app/Contents/Info.plist" "$app/Contents/Library/LaunchDaemons/com.aicc.agent-only-backup-registrar.plist"
sign='-'
if [[ "$mode" == "--release" ]]; then sign="$AICC_R2A1_SIGNING_IDENTITY"; fi
codesign --force --sign "$sign" "$app/Contents/MacOS/AICCBackupRegistrarDaemon"
codesign --force --sign "$sign" "$app"
codesign --verify --strict --verbose=1 "$app"
if [[ "$mode" == "--dev" ]]; then
  echo 'DEV BUILD ONLY: ad-hoc signature. Not approved for privileged registration or installation.'
else
  echo 'RELEASE CANDIDATE ONLY: requires independent signature/team verification and Owner macOS system approval.'
fi
printf 'BUILD_APP=%s\n' "$app"
printf 'APP_BINARY_SHA256='; shasum -a 256 "$app/Contents/MacOS/AICCBackupRegistration" | awk '{print $1}'
printf 'HELPER_BINARY_SHA256='; shasum -a 256 "$app/Contents/MacOS/AICCBackupRegistrarDaemon" | awk '{print $1}'

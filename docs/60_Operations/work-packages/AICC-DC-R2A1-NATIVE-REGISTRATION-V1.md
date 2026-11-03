# R2-A1 Native macOS Registration V1 — real compilation/installer precursor, NO EXPORT

**Purpose:** Build a native macOS app containing an embedded launch daemon via Apple's ServiceManagement SMAppService. This is the first independently auditable, genuinely compiled macOS registration component. It is **not yet an old Agent source exporter** or an installable production release.

## Fixed safety boundaries

- GitHub main is authoritative, Issue #85 tracks R2-A and R2-B.
- Target running legacy Agent is `us-macmini / com.byl.remote-mcp-us-agent`. Existing agent and all READY devices remain unchanged.
- Separate new launchd label: `com.aicc.agent-only-backup-registrar`, bundled inside `com.aicc.agent-only-backup-registration`.
- App commands: `--status`, explicitly triggered `--register` using Apple's `SMAppService.daemon(plistName:).register()`, `--open-settings`. App never automatically registers on launch or exports protected data.
- LaunchDaemon is inert: `RunAtLoad=false`, `KeepAlive=false`, no MachServices/sockets, no privileged file read, encryption, source capture, private path access or service control. Both program outputs explicitly mark `R2A1_EXPORT=DISABLED_NOT_IMPLEMENTED` and `R2A_REAL_BACKUP=NO`.
- `./build-app.sh --dev` builds a temporary **ad-hoc-signed** app only for compiler, plist and signing-integrity checks; **do not install/register this test build**. `--release` refuses to run without an independently approved external `AICC_R2A1_SIGNING_IDENTITY`; no signing keys or certificates in GitHub.
- macOS CI `macos-15` compiles both real binaries and verifies package structure/signatures; rejects any attempt to proceed with a missing release-signing identity. CI never invokes `--register`, `--open-settings` or private Agent export.
- No live privileged helper installation, OS authorization bypass, launchctl changes, Agent/OAuth/Gateway cutover, old Agent private-file extraction or device restart.

## Real prerequisites beyond this stage

1. Authorized service-release/security team enrolls a trusted macOS signing identity and independently verifies reviewed app/daemon hashes and provisioning. Current remote login has **0 usable signing identities**; its inability to write `/Library/PrivilegedHelperTools` must not be bypassed with shell/sudo.
2. Owner explicitly approves the **signed app** in macOS System Settings following native SMAppService registration; this is the future genuine Owner action gate. Apple documentation: https://developer.apple.com/documentation/servicemanagement/smappservice and https://developer.apple.com/documentation/servicemanagement/updating-helper-executables-from-earlier-versions-of-macos
3. A **separate reviewed and authorized exporter implementation** must then be supplied by the service operator to lawfully capture the actual private legacy Agent. A registration-only daemon cannot read it, cannot back it up, and is not deployment-ready. Previously denied private-source access remains denied through all current generic DC/fallback paths.
4. True R2-A after authorized capture requires source-side encryption, real capture receipt, detached Ed25519 owner enrollment, durable single-use ledger, two independent ciphertext storage failure domains with actual readback and recovery key outside Windows. Reuse merged PR #86 intake; 128MiB/24-hour gate. Actual isolated restore R2-B and Agent/OAuth Canary remain separately authorized STOP gates.

**Do not call this a fully working exporter.** Success here means native code/build CI readiness only, then macOS signing and installation approval — NOT a genuine old-Agent recovery backup.

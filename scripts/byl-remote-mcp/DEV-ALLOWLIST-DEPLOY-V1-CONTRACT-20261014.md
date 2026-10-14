# MCP Dev Allowlisted Deployment V1 — D0–D3 Contract

Status: **ISOLATED CANDIDATE ONLY; NOT REGISTERED, NOT INSTALLED, NOT DEPLOYABLE**. Tracks Issue #65. No change to production MCP, Cloudflare, SSH, WWW, ERP or ready devices.

## D0 verified 2026-10-14
- Formal OAuth MCP successful real read-only hostname on US, CN and Windows. `007windows` process ran but hostname characters returned garbled. Static `READY` remains non-authoritative (Issue #56).
- Formal `remote_list_tools` exposes Desktop Commander generic tools. No `dev_release_prepare/apply/status/rollback` were returned. No tool may be called under these names until formally registered and approved by the MCP operator, OpenAI tool access layer and Owner.
- Existing GitHub YBY-Core release pipeline builds/verifies artifacts, but `docs/release-engineering/Deployment.md` explicitly excludes WordPress site deployment. No approved Hostinger Dev receiver verified. Historical SSH/B1.1 files are not a reusable receiver.
- YBY-Core Andy OS PR #103 exact head `6dde090de9b4a99b0ffe0963ff2564f8852a1546`, base PR #99 and PR #90 remain unmerged. Current target Dev version/hashes are **not revalidated**.

## Proposed tool contract (not yet exposed)
`dev_release_prepare`, `dev_release_apply`, `dev_release_status`, `dev_release_rollback` are proposed names only. The formal runtime MUST independently register, authorize and route them. Never tunnel these via `start_process` or dynamically generated shell scripts.

### Input schema

Each mutating operation passes one exact JSON object:
- `schema=1`, `environment="dev"`, `project="byl-wordpress-core"`
- `releaseId`, `requestId`, `authorizationReceipt`: bounded, opaque identifiers
- `github: {repo, commitSha, prNumber, ciRunId}` with exact SHA/PR/CI match
- `artifact: {id,sha256}`: trusted GitHub artifact identifier and digest, never free URL
- `files: [{path,operation,beforeSha256,afterSha256}]`: explicit allowed relative file names; `add` requires `beforeSha256=null`, `replace` requires nonempty matching preimage

D1 initial **server-owned** allowlist restricted to YBY Core:
- `wp-content/plugins/yby-core/admin/class-yby-andy-os-navigation.php`
- `wp-content/plugins/yby-core/admin/class-yby-project-studio.php`
- `wp-content/plugins/yby-core/inc/class-yby-core.php`

Commerce and theme are deliberately NOT allowed yet; future projects require independent server-side allowlist, path and permission review. Reject extra fields including shell/command/script/sudo/restart/production_target, paths outside allowlist, arbitrary hosts, symlinks, file drift and writes to database or customer content.

## Security boundaries / required real adapters

Current `dev-allowlist-contract.mjs` and `dev-allowlist-controller.mjs` are pure ES modules. There is **no endpoint, receiver or OAuth tool registration**, and they cannot deploy.

Production-ready integration needs independently approved, mutually authenticated adapters owned by the MCP service (not supplied by ChatGPT text):
1. **Authority**: verify Owner receipt scope, expiry and anti-replay; fetch exact GitHub HEAD and CI from authenticated trusted source; fetch immutable artifact digest and approved file list; distinguish read-only status authority from Dev apply/rollback.
2. **Durable store / lock**: persistent per-project lock and receipt journal, owner/project/env tuple, crash recovery, no repeated partially completed apply.
3. **Dev receiver**: already approved and path-bound to only `dev.beyourlover.com`; independently verify site identity, canonical realpath and no symlinks, exact pre/post bytes and chmod, out-of-Web-root staging and verified backups, PHP lint, atomic replace per file with controlled multi-file transaction, server-side rollback; never expose general SSH/command interfaces.
4. **MCP registration**: fixed four tool schemas and separate operator allow permissions. A UI label or old Desktop Commander tool list does not create a permission grant. Platform safety rejection is final for the affected call; never bypass by encoding/renaming/changing routes or devices.
5. **Approval gate**: Dev-only authorization by Owner and actual tool/server administrator before any real wiring/canary. Production/WWW/ERP and READY-service restart are excluded.

`prepare` validates authoritative approval, inspected preimage, verified backup and unchanged runtime without touching live WordPress; `apply` re-attests and checks preimage again, asks the trusted receiver to perform only the exact allowlisted update, rechecks postimage; on partial error attempts verified rollback or records `MANUAL_RECOVERY_REQUIRED`. `rollback` requires separate authorized action, exact postimage and verified restoration. `status` is independently read-authorized and redacted. Release IDs are idempotent in durable storage.

These are **adapter contracts**, NOT evidence that real Hostinger filesystem symlink, identity, backup, PHP lint, rollback or atomic multi-file semantics have been implemented. In-memory fake adapters test state transitions only.

## D3 exit / negative tests
Automated Node tests cover: valid prepare/apply/rollback, no running file write on prepare, same-release replay, bad environments, command injection fields, path escape, Commerce crossing, wrong repo, forged receipt syntax, failed CI, denied Owner proof, changed PR HEAD, unauthorized path set, stage/runtime drift, site spoof, broken backup, rollback recovery failure and status authorization.

CI only certifies policy and in-memory controller; **not** real Dev Canary. D4/D5/D6 remain BLOCKED until officially registered tool, trusted production-hosted receiver and Dev-only Owner approvals are available.

## Andy OS D5 safety
Never re-develop PR #103 here. Before any trial, re-read exact PR SHA and all four relevant CI gates; check current Dev file SHA vs approved patch before/after. Do not overwrite the newer Commerce plugin, old Dev B1.1 features or any entire plugin ZIP. Require new Release ID, Owner receipt, backup outside web, smoke and PC + 390px iPhone 14 Owner UAT. No automatic merge or WWW deployment.

## Governance
GitHub main is the target source of truth; this branch and its Draft PR are candidates only. Keep old V2 Issue #57 closed as Owner paused; separate scoped task #65 is active. No merging, production code modification, server restart or Cloudflare auth change.
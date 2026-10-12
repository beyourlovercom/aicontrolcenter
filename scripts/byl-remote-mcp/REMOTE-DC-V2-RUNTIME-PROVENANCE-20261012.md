# DC Remote V2.0 — GitHub/runtime provenance gate (2026-10-12)

This file records read-only hashes and governance; it does not introduce or modify any production service. **GitHub main** is the desired canonical release source, but the existing G15 Owner-PASS runtime has not yet been completely aligned to it.

## Facts verified by formal production OAuth MCP

- GitHub main: 1864f3e1859ada878f4859b2b9266389205c2978
- V2 Draft PR #58 original head: a4a43b873b67b95f0685b577806deb9d0fde28d1 (CI SUCCESS; no merge/deploy).
- OAuth PR #51 open/unmerged head: 776617c3635bca6b31bdc6a4edbe45fbec4d6334.
- Official production URL remains https://mcp.beyourlover.com/oauth/mcp; legacy https://mcp.beyourlover.com/mcp remains separate. No new /chatgpt/mcp route.
- On US Mac mini, supervised 8797 OAuth source file bytes match GitHub PR #51 exact head:

| OAuth file | GitHub PR #51 vs 8797 local |
|---|---|
| mcp-endpoint.mjs | BYTE MATCH |
| access-auth.mjs | BYTE MATCH |
| endpoint-routing.mjs | BYTE MATCH |
| operator-policy.mjs | BYTE MATCH |

These comparisons used source SHA-256 and emitted only a match result. Cloudflare Access JWTs, private keys, credentials and gateway tokens were not read or copied.

## Main not yet tracking runtime infrastructure

The following source files were observed in the US Mac mini runtime worktree but were NOT tracked by GitHub main at the above SHA; their hashes are evidence for the audited checkout only, not proof of parity with every remote device's currently executing process.

| Relative path inside scripts/byl-remote-mcp | Local SHA-256 |
|---|---|
| gateway.mjs | c59e4d1d7fabdad4a03d896d7d5ebffd7e2bcb864ffdadab4a5f0f0d6cc29b7c |
| device-router.mjs | 539df095c7d5f9eee890152336d524f3a935087d941a23add5d2fecfb473bff4 |
| dc-agent-macos.mjs | 6fb0512be58a932b8b44697ef44f7b6c2d4a58dcf917d887dd51780a4d66b0a0 |
| dc-agent-windows.mjs | 23cc2f7d3848b33872dc3c27a9a31dd8988a636fda78ee525139966bd897c5e2 |
| health-monitor.mjs | bad17db1d4658a1cc0a1ce13a7ee25d1828d965d7145f806671f93113e8d2c5f |

Do NOT treat these files as approved release artifacts until reviewed against actual deployed configurations on all devices, licensed dependencies and GitHub main code.

## Governance before any production integration

1. Independently review PR #51 for Owner JWT/OAuth policy, route isolation, base branch drift and security tests. Requires separate exact-head merge authorization. A running release is not permission to merge code.
2. Reconcile the untracked runtime source in a new isolated source-parity PR, preserving unrelated local modifications and excluding any secrets, API tokens, private keys, .env, logs, caches, production DB and user content.
3. V2.1 signature handshake must be independently reviewed: pin per-device Ed25519 public keys, establish private-key lifecycle in agent, nonce/TTL and replay protection, signed response verified against expected registry device ID. Existing agents DO NOT yet implement the response handshake.
4. Prove live health with both healthy and Tailscale-stopped devices in isolated UAT. Avoid static READY and avoid auto-restart of READY machines.
5. PR merge, remote agent code deployment, Cloudflare/Gateway changes and production cutover are separate gates. This PR grants none of them.

## V2.1 progress at this checkpoint

The V2.1 pure health contract now has a separate Ed25519 signed challenge/response test implementation in remote-v2-signed-health.mjs and companion tests. Signed probe uses caller-supplied fixed device transport, and will report healthy only after a device-ID-bound valid signature; unsigned/spoofed responses, expiration, arbitrary device IDs, transport failure and service degradation are tested. All generated test keys are ephemeral/in-memory; no persistent secrets were created. Production integration NOT performed.

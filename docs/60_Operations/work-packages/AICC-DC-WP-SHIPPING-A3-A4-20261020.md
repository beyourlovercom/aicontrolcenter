# AICC DC Shipping Read-only Browser A3/A4 — Authorized Work Package

**Owner approval:** 2026-10-20: "同意，继续。授权A3 A4".  
**Parent:** #101 and Draft PR #102; **stacked branch base:** exact A2 HEAD `a9476b9acd9a874874f14c3512938625444cf699`.  
**Scope:** A3 Dev-only browser functionality and A4 consent-scoped WWW **read-only** implementation & evidence. NOT production deployment of the formal OAuth MCP/Gateway/Agent, NOT main merge or installed-Chrome modification without a lawful, separately audited release procedure.

## Requirement
Allow the Owner to inspect WooCommerce Shipping Zones and per-zone Shipping Methods in an authorized Chrome profile without screenshots, ultimately consumable via the existing signed self-hosted DC *named read_file* transport. Prefer a standalone dedicated browser extension, **not** modification of AICC's ChatGPT Bridge permissions. Zero WordPress writes and no login/session/token/cookie/nonce export.

## Architecture (safe minimum)
1. Dedicated **uninstalled source-only** Chrome MV3 extension under `scripts/byl-remote-mcp/wp-shipping-audit-extension/`. `action` popup shows separate **Dev** and **WWW** "Read Shipping Zones" and "Read Zone Methods" controls. Optional host permissions restricted to `https://dev.beyourlover.com/*` and `https://www.beyourlover.com/*`; require a direct human popup interaction and native Chrome permission prompt. No hidden permission grant.
2. For an approved request, browser creates **one temporary audit tab** in the currently selected Chrome profile; scoped fixed URL constructed from enum operation and validated numeric zoneId. No arbitrary URLs, JS commands, generic click, form submit, Woo AJAX write, Chrome profile restart, OS automation. Never inspect existing order/customer pages.
3. Prefer a **tab-bound temporary declarativeNetRequest session rule** that blocks non-GET methods on the temporary tab before navigating, removes the rule in finally, closes the audit tab; record partial/blocked/unknown states on any failure. Never disable any user's existing filters or rules.
4. Parse only selected, visible WooCommerce shipping administration UI DOM fields into a strict whitelist: zone ID/name/priority/regions; method type, instance ID, enabled, flat cost, free min, coupon-discount flag, shipping class costs where actually displayed. If a detail is not visible or Woo admin markup changed, emit `null`, `UNKNOWN`, `partial:true` and warnings; **never guess**. Do not return raw HTML, addresses, nonces, cookies, headers, orders or customers. Treat zero-cost flat rate as flat rate, not free-shipping.
5. Owner-triggered export to a **redacted, versioned JSON file** in Chrome Downloads using Chrome's downloads API. This can be inspected through the formally authorized self-hosted `remote_call(read_file)` by exact observed path in a later UAT. Never silently send data to an external server or GitHub. File naming fixed with environment, operation, UTC timestamp and safe zoneId; avoid overwriting or constant filename collision. File is stored locally; mention revocation & deletion guidance.
6. Do not edit the installed AICC ChatGPT Bridge, change actual Chrome runtime, register production OAuth tools or broaden the current MCP's authority. A4 approval authorizes **read-only WWW host scope design + user-consent flow**; no production service cutover without its own exact-head gate.
7. Build focused Node tests of pure gate / DOM parser with synthetic HTML fixture (not real WordPress), permission denial, URL/redirect guards, no-write transport, token/nonce suppression, empty/partial markup, free vs flat semantics, GBP currency display without incorrect threshold conversion. Add dedicated focused GitHub Actions workflow with least privilege (contents:read), no Cloud CI minute assumptions.
8. Reuse branch PR #102's A2 normalizer as **separate** Dev contract; any new adapter must not fake `networkWrites:0` by untrusted observation. Do not claim a real browser or real WWW UAT without an actually installed extension and verified receipts.
9. Only development and isolated testing in this work package. No production WC settings/order/stock/payment/coupon writes, GitHub main merge, READY restart, original Gateway runtime edit, AppleScript safety bypass or agent private-file access.

## Tests / acceptance
- A3: offline content extraction positive/negative tests; optional isolated temporary Chrome test against anonymous Dev only, **never** navigate/click the signed-in Owner's Chrome via unsupported tools. Capture test trace and evidence.
- A4: permission consent flow, WWW URL allowlist, no unsafe navigation or POST, separate extension installation consent. Must explicitly record **not installed** if not installed; no real WWW audit UAT claim.
- Current production Shipping Zones discovery remains pending until owner-approved installation and real browser UAT. Checkout B branch handles real shipping calculations (#151), no code overlap.
- Submit stacked Draft PR based on A2 branch, record exact HEAD and CI before any later merge/release.

## Governance / provider routing
GPT owns scope/review. Global `AI-EXECUTOR-GOVERNANCE-V2` routes implementation to US governed Claude by default; deterministic tests to governed Codex or Node runner. This work package is the explicit Owner authorization for A3/A4 scoped implementation; it does not authorize production rollout or merge.

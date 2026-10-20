# AICC-DC-WP-ADMIN-READONLY-V1 — A2 isolated source candidate

**Issue:** #101 · **Environment:** OFFLINE / DEV-ONLY · **Status:** NOT DEPLOYED

## Purpose
Build the smallest reusable **typed browser-observation seam** for a later, separately approved WordPress WooCommerce Shipping Zones audit. No production access, no arbitrary browser navigation, no login, no token/cookie extraction, no Woo mutation.

## Added files
- `scripts/byl-remote-mcp/wp-shipping-audit-readonly-a2.mjs`: fail-closed API `auditDevShipping(input,{principal,windowPid,readPage,lock})`; accepts only `zones` or `methods` with numeric `zoneId`. It produces a fixed Dev-only HTTPS URL with specific query shape, refuses caller URLs, HTTP actions, and additional properties.
- `scripts/byl-remote-mcp/wp-shipping-audit-readonly-a2.test.mjs`: dependency-injected synthetic browser snapshots and negative cases; **does not use a real browser or WordPress session**.

## Security invariants
1. Trust and explicit approval come from the separate, injected `principal` dependency; inputs alone cannot grant it. The future live connector **must verify the real OAuth principal and operator policy**; a caller must never supply `principal` through an exposed tool schema.
2. `readPage` is a trusted browser observation adapter, **not bundled/implemented in A2**. It must bind an already-open, independently approved Dev browser window/profile/PID. It must never navigate, submit forms, perform AJAX mutations or POST.
3. Browser evidence requires exact URL, exact PID, verified browser+profile+window, HTTP GET, `networkWrites=0`, `navigationPerformed=false`, no redirect. This is an adapter attestation contract and **not independent proof of implementation**.
4. `lock` is required and injected by a trusted connector, not by callers; missing lock fails closed.
5. Return values are allowlisted and structured: zone IDs/names/priorities, region codes, enabled methods, instance IDs, rate expressions, minimum amounts, apply-before-discount flags, shipping-class costs. Raw DOM, HTML, nonces, session IDs, headers and personal/order data are never included.
6. Do not interpret `flat_rate` cost `0` as a Woo Free Shipping method. Do not infer active free-shipping thresholds for zones lacking a `free_shipping` instance.
7. Missing or unsafe extracted values fail closed; never invent data or claim live production parity.
8. All source is **unregistered**, not reachable by ChatGPT OAuth MCP tool discovery, and **cannot read WWW**.

## A2 acceptance
- Run `cd scripts/byl-remote-mcp && node --test wp-shipping-audit-readonly-a2.test.mjs` and existing scoped tests.
- Check canonical main SHA, isolated branch diffs, and CI when GitHub Actions availability permits.
- Open Draft PR; no merge, no runtime registration, no production OAuth/Cloudflare/Agent changes, no READY device restart.
- Owner review will decide A3 Dev read-only browser adapter design and testing, separately from WWW permission expansion at A4.

## Follow-up limitations and gates
- No actual GUI/WordPress data extraction occurs in A2; adapting it requires a **formally permitted browser integration**.
- A3 must independently verify exact Dev browser profile/window origin and execution receipts, without OS-automation bypass of safety refusal.
- A4 MUST receive a separate Owner gate before even proposing WWW host permission expansion or installation of a registered named production read-only tool.
- Shipping calculation fixes remain website Checkout B branch (#151, #150); this PR is for DC audit transport only.
- Existing AICC G1 (#96), R6, Dev Deployment #66 and deployed agents/gateways remain untouched.

## Provider/governance note
Source-only focused module uses fixed scope and deterministic mock tests. Per global governance, governed implementation provider routing is CLAUDE_CODE_US unless a specifically documented narrower implementation exception is approved. This branch contains a candidate for governed code review and exact-head CI; it does not assert governed Claude execution or waive any release gate.

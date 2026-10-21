# AICC DC Woo Shipping A5 — Instance Detail Read-only Extension

**Owner authorization:** 2026-10-21 "批准" in response to proposal to add a Dev-first fixed-instance details audit.  
**Parent Issue:** #101. **Base:** A3/A4 Draft PR #104 exact-head `2ab7660ddd559794be15351b4d95a48f3177af5f`.  
**Scope:** separate isolated A5 branch / stacked Draft PR; do **not** modify live extension installation, official OAuth MCP registry, WWW Woo settings or GitHub main.

## Real audited WWW evidence
Owner-consented Chrome DOM snapshots independently read via formal China Mac OAuth MCP:
- Zone 0 -> Free Shipping instance 1; Flat Rate instance 3
- Zone 5 -> Free Shipping instance 9; Flat Rate instance 10
- Zone 4 -> Flat Rate instance 7; Free Shipping instance 8
- Zone 3 -> Flat Rate instance 5; Free Shipping instance 6
- Zone 1 -> Free Shipping instance 2

All methods are enabled on Woo method-list screen, but that screen hides actual `cost`/`requires`/`min_amount`/`ignore_discounts` and class costs. Never equate admin shipping-zone name with a verified setting. Source: real WWW owner-exported five JSON files from 2026-10-21.

## A5 implementation contract
1. Add **one new enum-only** action `instanceBatch` to existing separately installed, Owner-triggered audit popup; zero caller-provided URL, instance IDs, JavaScript or HTML selectors. Static allowlist consists of the exact nine observed instance IDs. Apply same list to Dev for dry-run, but do **not** assume Dev instance association is correct; any mismatching type/empty form must be visibly flagged and prevents Dev PASS.
2. Every target derives fixed HTTPS URL `/wp-admin/admin.php?page=wc-settings&tab=shipping&instance_id=N`. WooCommerce `WC_Settings_Shipping::output_zones_screen()` dispatches GET `instance_id` to `instance_settings_screen`; form writes require an explicit POST save + nonce. We must not make such requests.
3. Reuse A3/A4 native Chrome host consent; a temporary tab-scoped DNR rule blocks non-GET methods **before** the first navigation; sequential operation only, bounded with a hard limit of nine reads; verify URL, chrome profile and expected host on every instance. Any redirect away from the fixed URL is a STOP, not a retry. Keep the existing session-storage orphan recovery protocol and ownership checks, no reboots or old/DC/browser policy workaround.
4. Extract only known Woo shipping instance form controls through exact IDs. Free: `requires` (enum `'',coupon,min_amount,either,both`), `min_amount` numeric or empty, `ignore_discounts` checkbox checked. Flat: `cost` numeric or empty, `no_class_cost` numeric or empty, `type` class/order; `class_cost_NUMERIC_ID` rows (max 40) and no shipping class names. Unknown formula remains `null` and `partial:true`; do not dump raw form markup, options, cookies, nonces, user info or arbitrary text. Always mark `priorZoneId` as from prior observation, not verified from this detail page.
5. Local redacted JSON file only, built-in `downloads`; report exact download path after Chrome download completed. No export to GitHub/Gmail/logging services.
6. **Dev Owner UAT first** after source review and focused CI; keep WWW action gated by fresh, explicit native Chrome host-consent interaction when actual UAT occurs. The owner authorized A5 development, **not automated WWW navigation via remote commands**. No Chrome extension auto-install or mutation of user's installed A3/A4 version.
7. Document that ordinary authenticated GET may trigger routine site logs/cache/cron; cannot guarantee zero DB writes. This mechanism must never intentionally submit order or Woo settings changes.
8. Existing A3/A4 `zones` / `methods` operations remain backward-compatible; run A2+A3+A4+A5 deterministic tests. Isolated Draft PR, focused GitHub CI and exact-head provenance; no main merge or Gateway/Agent/READY restart.

## Acceptance / stopping
- Tests: fixed nine targets, WWW host spoof/redirect attempts denied, no arbitrary IDs/URLs, fixture extraction, malformed/secret values treated UNKNOWN, `ignore_discounts` meaning, $0 flat rate vs Free Shipping, class costs, partial/error handling and preservation of A3/A4.
- Dev test receipt: correct page identity, per-instance field values or explicit UNKNOWN; no invented rate.
- WWW test receipt: requires real Owner Chrome consent and the previously observed mapping; A5 compilation or Dev-only tests are *not* evidence of live WWW settings.
- Checkout B Website Issue #151 owns policy/rate correction, not this transport task.

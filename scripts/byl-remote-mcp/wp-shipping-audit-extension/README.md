# BYL WooCommerce Shipping — Read-only Chrome Audit (A3/A4)

**Version:** 0.1.0 candidate · **Work Package:** [#101](https://github.com/beyourlovercom/aicontrolcenter/issues/101) · **Status: NOT INSTALLED / NOT CONNECTED TO PRODUCTION OAUTH MCP**

This is a *separate* Manifest V3 extension. It does not change the installed AICC ChatGPT Bridge or your live WordPress plugins.

## Owner-run UAT only (after exact-head source and security review)

1. On an authorized Chrome profile already logged into the intended **Dev or WWW** WordPress site, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `wp-shipping-audit-extension` directory.
2. Pin the new **BYL Woo Shipping Read-only Audit** extension. Open its popup and select **Dev** first. Click **Grant access and read**; review the native Chrome host permission prompt. No permission is requested until that click.
3. Read the **Shipping Zones list**. A dedicated background worker opens a temporary tab on a fixed WooCommerce admin GET URL and activates a tab-scoped non-GET blocking rule **before** navigation; it closes the tab after inspection and records bounded orphan-cleanup state if interrupted.
4. After the Chrome download reports complete, the extension displays its **resolved local path**. A local file such as `BYL-shipping-readonly-DEV-zones-2026-10-20T00-00-00-000Z.json` is placed in the current Chrome Downloads directory. No browser cookies, order details, HTML or authentication tokens are intentionally exported. The operator can review it via existing authorized DC `read_file` after verifying its **exact path**.
5. Only after Dev has a valid partial-or-complete receipt should you repeat for **WWW**, with separate native Chrome host access consent. For method instances, select **Shipping Methods for one zone** and enter the zone ID. The plugin never edits WC settings or follows non-allowlisted URLs.

## Interpretation / important limits

- Only fields **already exposed by the WooCommerce admin DOM** can be reported. Per-instance coupon-discount flags and shipping-class costs are not extracted in this version. WooCommerce versions often hide Flat Rate costs and Free Shipping minimums inside an Edit modal; these are **null/UNKNOWN** if not visible on the list. No output should be presented as a complete production Shipping Zones inventory unless every required value is independently verified. No automatic cross-zone iteration or hidden modal clicks are implemented.
- `flat_rate: $0` is still a **Flat rate**, not an active `free_shipping` rate.
- This extension never fetches an arbitrary URL, submits a Woo form, reads a customer/order page, reads credentials or cookies, or sends a report to a network server.
- Chrome DNR requests blocking of POST/PUT/PATCH/DELETE/CONNECT/OTHER network requests associated with the **temporary audit tab** while it is open. It cannot guarantee absolute zero database-side effects from a WordPress admin GET. It does not assert that arbitrary site-side GET routes are side-effect-free, and it cannot override all other installed extensions.
- If the site redirects to login, the page is not Shipping Settings, Chrome declines permission, or parsing cannot verify the expected URL, the operation fails closed. If the expected page loads but fields are absent, the JSON marks `partial:true`; it does **not** invent zeros.
- The popup asks permission independently for `https://dev.beyourlover.com/*` and `https://www.beyourlover.com/*`. This is **not an OAuth permission grant** and does not activate a new ChatGPT callable MCP tool. A standalone production MCP tool remains a separate exact-head release gate.
- Local downloaded JSON should be handled as business data; remove it after review using your ordinary Downloads controls. Revoke site access or uninstall this extension from `chrome://extensions` at any time.

## Engineering acceptance and evidence

Run on an isolated checkout:

```bash
node --check scripts/byl-remote-mcp/wp-shipping-audit-extension/popup.mjs
node --check scripts/byl-remote-mcp/wp-shipping-audit-extension/background.mjs
node --test scripts/byl-remote-mcp/wp-shipping-audit-extension/guard.test.mjs
node --test scripts/byl-remote-mcp/wp-shipping-audit-readonly-a2.test.mjs
```

The dedicated GitHub Actions workflow runs these tests with read-only repository permissions. A successful source test does **not** equal live browser UAT, WP admin data read, installed Chrome consent or production OAuth registration.

## Handoff

A3/A4 browser source and scoped optional permissions are delivered as a stacked Draft PR on the A2 branch. **No AICC main merge, Production Gateway/Agent release, Chrome install, WWW mutation or READY device restart** is allowed in this work package. A5 still needs a real verified WWW shipping-config receipt, and Checkout B retains sole ownership of shipping calculation fixes.

## A5 — fixed 9 shipping instance details (v0.2.0, isolated source candidate)

**Not installed, not production OAuth registered, not real Dev/WWW UAT PASS.**

The new popup choice `Shipping instance details · fixed 9 (read only)` uses an exact URL/ID list independently observed in the Owner's **WWW** Shipping Methods UAT: IDs `1,3,9,10,7,8,5,6,2`. Each has a known method kind and prior zone ID (0/5/4/3/1). The prior zone mapping is historical evidence; the instance detail page does **not** independently confirm it.

WooCommerce supports a separate admin instance settings page:
`/wp-admin/admin.php?page=wc-settings&tab=shipping&instance_id=N`.
This Chrome extension performs **one fixed GET at a time**, protected by a per-tab non-GET block, then closes the temporary tab before removing the blocking rule. No arbitrary URL, Woo admin click, submit, nonce, cookie, user data or API key is read. Nine reads are sequential and may take a couple of minutes. If a form is missing or a redirect happens, the audit stops with an error instead of guessing.

Data emitted **only if form fields exist**:
- Free Shipping: `requires` enum (`''`, `coupon`, `min_amount`, `either`, `both`), `minAmount`, `ignoreDiscounts` (checkbox).
- Flat Rate: `cost`, `noClassCost`, `calculationType`, numeric-ID `classCosts`, max 40.
- Numerical costs (including zero) and explicit blank are preserved. Complex Woo cost formulas or unexpected values become `null` / `partial=true`; never export raw form markup/labels, script, HTML or cookies.

**Owner Dev-first UAT sequence after code review and exact-head CI:**

1. Download the newly generated **BYL-Woo-Shipping-Readonly-A5-Instance-Details** artifact from the A5 PR's successful GitHub Actions run. Unzip to a distinct Owner-controlled folder. The previous A3/A4 extension remains unchanged.
2. From normal Chrome `chrome://extensions` UI, explicitly **Load unpacked** the new extension and approve permission only for `Dev · dev.beyourlover.com`.
3. Select `Shipping instance details · fixed 9 (read only)`; click **Grant access and read** once. The extension exports `BYL-shipping-readonly-DEV-instances-9-<timestamp>.json` only when all nine fixed, expected instance detail forms could be verified. If Dev IDs have drifted, it may stop safely; report the popup's exact error.
4. Confirm Dev JSON with the formal signed China Mac DC `read_file`, check nine IDs, expected types, cost/threshold and `partial`. **Actual Owner Dev UAT PASS is required; source unit tests do not substitute.**
5. Only afterwards use Owner UI to consent for `WWW` to audit the same nine fixed details, and compare with observed WWW Shipping Methods receipts. The extension also enforces completion of the Dev export before enabling its WWW batch operation. This *technical* gate is not a substitute for separate human Dev approval.

**Known limits:** This is browser-mediated **read-only** navigation, not a new callable OAuth browser tool; signed DC reads only the downloaded local JSON. WordPress authenticated GET pages may trigger routine logging/cron/caching; do not claim literal zero DB writes. Do not change WWW Woo settings, discount/checkout hooks, payments, orders, installed Gateway/Agent, or READY machines in this task. Draft PRs #102 / #104 remain unmerged; A5 is a stacked Draft PR only. Existing A3/A4 Zones and Methods operations remain available.

Technical evidence tests:

```bash
node --test scripts/byl-remote-mcp/wp-shipping-audit-extension/instance-guard.test.mjs
node --test scripts/byl-remote-mcp/wp-shipping-audit-extension/instance-background.test.mjs
```

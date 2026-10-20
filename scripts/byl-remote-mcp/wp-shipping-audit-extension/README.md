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

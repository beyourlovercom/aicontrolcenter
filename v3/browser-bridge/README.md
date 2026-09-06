# AICC V3 ChatGPT Browser Bridge

Status: V3.8.2 implementation checkpoint.

## Install on CN Mac

1. Open `chrome://extensions` in Google Chrome.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this exact directory: `v3/browser-bridge`.
5. Pin **AICC V3 ChatGPT Bridge** if desired.

## Pair without exposing the token

From `v3/`, run `npm run bridge:pair`. The command creates/reads the local AICC Bridge credential and copies it to the macOS clipboard without printing it.

Open the extension popup, paste into **Pairing token**, and choose **Pair / Verify**. The token is stored only in privileged extension storage with `TRUSTED_CONTEXTS` access; the ChatGPT content script cannot read it.

## Explicit execution

On a `https://chatgpt.com/.../c/<conversationId>` page, the extension adds `✦ AICC` to Assistant turns. Clicking it is the explicit Owner action. Select an existing AICC Task, review the exact instruction, then choose **Send to AICC**.

The extension never executes merely because a page renders or becomes active.
## Same-conversation return

The privileged background client keeps the immutable conversation binding and local write-ahead ledger. It may navigate only to that explicitly bound conversation; it never chooses the active/latest conversation.

Before a send side effect, the content adapter verifies:

- exact `conversationId`;
- exact Canonical Result SHA-256;
- exact composer content;
- an available send control.

A proven pre-send failure reports `ABORTED_BEFORE_SEND`. After the send click begins, lack of proof becomes `UNCERTAIN`; there is no automatic second send. A lost receipt response retries the receipt only, never the ChatGPT message.

## Security boundary

The extension requests only `storage`, `tabs`, and `alarms`, with host access limited to `chatgpt.com` and `127.0.0.1:1420`. There is no `activeTab`, `<all_urls>`, wildcard CORS dependency, latest-conversation lookup, or content-script access to the Bridge token.

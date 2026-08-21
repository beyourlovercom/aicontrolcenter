# AICC Bridge V2

Minimal Owner-controlled Chrome MV3 bridge. It captures one complete
`AICC_EXECUTION_V1` block from the current Assistant message, sends it to the
local AICC service, and inserts a READY Run Report only after an Owner click.

`NEW_EXTENSION_ROOT = web-adapter/chrome-extension-v2/`
`BRIDGE_CONTROL_COUNT = 2`
`AUTO_REPORT_INSERT = 0`
`AUTO_SEND_CHATGPT_MESSAGE = 0`

Load `web-adapter/chrome-extension-v2` as an unpacked extension. Disable the
legacy AICC Bridge during V2 Owner UAT so only one toolbar is active.

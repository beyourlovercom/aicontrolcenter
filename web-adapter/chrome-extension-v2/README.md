# AICC Bridge V2

Minimal Owner-controlled Chrome MV3 bridge. It captures one complete
`AICC_EXECUTION_V1` block from the current Assistant message, sends it to the
local AICC service, and inserts a READY Run Report only after an Owner click.

Load `web-adapter/chrome-extension-v2` as an unpacked extension. Disable the
legacy AICC Bridge during V2 Owner UAT so only one toolbar is active.

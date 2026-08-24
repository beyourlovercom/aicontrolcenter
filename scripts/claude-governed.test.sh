#!/bin/bash
set -euo pipefail
WRAPPER="$(cd "$(dirname "$0")" && pwd)/claude-governed"
LOCK_DIR="/Users/a/.aicc-remote/claude-cli-implementation.lock"
cleanup(){ rm -rf "$LOCK_DIR" /tmp/aicc-governance-test-*; }
trap cleanup EXIT
cleanup

out=$(AICC_CLAUDE_GOVERNANCE_DRY_RUN=1 "$WRAPPER" -p test)
grep -q 'MODEL=claude-sonnet-4-6' <<<"$out"
grep -q 'EFFORT=low' <<<"$out"
grep -q 'SUBAGENTS_ALLOWED=NO' <<<"$out"
grep -q 'MAX_CONCURRENT_IMPLEMENTATION=1' <<<"$out"

set +e
AICC_CLAUDE_GOVERNANCE_DRY_RUN=1 "$WRAPPER" -p test --effort high >/tmp/aicc-governance-test-high.out 2>/tmp/aicc-governance-test-high.err
rc=$?
set -e
[[ $rc -eq 64 ]]
grep -q 'CLAUDE_NONLOW_EFFORT_REQUIRES_GPT_EFFORT_ESCALATION_EVIDENCE' /tmp/aicc-governance-test-high.err

out=$(AICC_GPT_EFFORT_ESCALATION_EVIDENCE=GPT-EFFORT-TEST AICC_CLAUDE_GOVERNANCE_DRY_RUN=1 "$WRAPPER" -p test --effort high)
grep -q 'EFFORT=high' <<<"$out"

set +e
AICC_CLAUDE_GOVERNANCE_DRY_RUN=1 "$WRAPPER" -p test --model claude-sonnet-5 >/tmp/aicc-governance-test-s5.out 2>/tmp/aicc-governance-test-s5.err
rc=$?
set -e
[[ $rc -eq 64 ]]
grep -q 'CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE' /tmp/aicc-governance-test-s5.err

out=$(AICC_GPT_SUBAGENT_ESCALATION_EVIDENCE=GPT-SUBAGENT-TEST AICC_CLAUDE_GOVERNANCE_DRY_RUN=1 "$WRAPPER" -p test)
grep -q 'SUBAGENTS_ALLOWED=YES' <<<"$out"

nohup env AICC_CLAUDE_GOVERNANCE_TEST_MODE=1 AICC_CLAUDE_GOVERNANCE_TEST_HOLD_SECONDS=2 "$WRAPPER" -p holder >/tmp/aicc-governance-test-holder.out 2>&1 &
holder=$!
sleep 0.25
set +e
AICC_CLAUDE_GOVERNANCE_TEST_MODE=1 "$WRAPPER" -p second >/tmp/aicc-governance-test-second.out 2>/tmp/aicc-governance-test-second.err
rc=$?
set -e
[[ $rc -eq 75 ]]
grep -q 'CLAUDE_IMPLEMENTATION_CONCURRENCY_LIMIT' /tmp/aicc-governance-test-second.err
wait "$holder"
[[ ! -d "$LOCK_DIR" ]]

# Exercise the real child wait/exit forwarding path under zsh. `status` is a
# readonly zsh parameter, so this guards against regressions in the wrapper.
set +e
AICC_CLAUDE_GOVERNANCE_TEST_MODE=1 AICC_CLAUDE_GOVERNANCE_TEST_CHILD_EXIT_CODE=23 "$WRAPPER" -p exit-forward >/tmp/aicc-governance-test-exit.out 2>/tmp/aicc-governance-test-exit.err
rc=$?
set -e
[[ $rc -eq 23 ]]
! grep -q 'read-only variable' /tmp/aicc-governance-test-exit.err
[[ ! -d "$LOCK_DIR" ]]

echo 'Claude governed wrapper execution gates passed'

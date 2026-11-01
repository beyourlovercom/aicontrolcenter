# AICC Executor Governance V3 — DC-primary Dev Candidate

Status: DEV_CANDIDATE / NOT ACTIVE ON GITHUB MAIN OR PRODUCTION

Owner-scoped Work Package: AICC-EXECUTOR-DC-PRIMARY-V3
Baseline: beyourlovercom/aicontrolcenter main at 69c8a7816d3a75a50b40eab11c8123eda0ae2e4a
Supersedes V2 **only after** independent Owner exact-head merge and installed runtime adoption. The V2 file remains historical evidence; this draft has no authority to alter live service behavior.

## Intended operating model

- GPT determines work and uses **formal self-hosted BYL DC OAuth** as the primary supervised tool channel for routine read-only inspection, bounded local engineering and permitted Dev tests.
- Governed **Codex** is invoked only for independently justified security-sensitive reviews, deterministic audit or special existing canonical rules. Never as an implicit fallback for failed DC access.
- **Claude retired.** Do not route new work to it. Do not infer authorization from a retired provider's historic session or token. Legacy records are preserved read-only.
- Static `READY` registry is not cryptographically verified device health. Signed Agent validation, private Operator Policy identity, protected Agent backup and production cutover retain their independent STOP gates.

## Explicit execution boundary

GPT-supervised direct DC tool calls and AICC's automatic executor are **different trust boundaries**. The former remains subject to the authenticated formal OAuth tool's device-specific policy and platform safeguards. This V3 candidate does NOT make AICC an automatic remote DC dispatcher.

For AICC-controlled automatic dispatch, `SELF_HOSTED_DC` is a valid *intent* but must yield `STOP_GATE: DC_AUTO_DISPATCH_NOT_AUTHORIZED` until a separate Owner-approved, independently reviewed and deployed typed adapter is available. Do not forward free-form instructions to start_process, a shell, or a generic remote_call. Do not alias the DC provider to legacy CLAUDE_CODE or quietly run a Codex task.

A future typed adapter requires exact repository identity, canonical main SHA, worktree and branch, approved Work Package, bounded tool operation and fixed device list, explicit separate scoped Owner authorization, single-writer lease, redacted receipts, clean recovery and STOP on timeout, unavailability or any safety denial.

## Guardrails

- No Claude launches, fallback or retained implicit default for *new* V3 requests.
- No automatic merge, PR Ready for Review, deployment, protected source export, credential changes or production writes.
- No reboot/restart of READY devices, Gateway, Agent, launchd or Chrome.
- No retry via another connector/tool to bypass a failed authorized permission check or prior sandbox Git write denial.
- Historical V2 jobs and persisted receipts are not mass-migrated; release migration must be separately reviewed.
- Production does not inherit this candidate until exact-head Owner merge, runtime upgrade and readback.

## Dev acceptance

Check V3 policy tokens and override/routing validation; forbid Claude; verify default DC for CODE_CHANGE and TEST_ONLY; Codex only with explicit special-review reason; no implicit fallback; reject unsafe automatic DC dispatch before any task or run creation; bridge/Next-Step STOP gates; adverse cases for missing Owner scope, arbitrary operations, device spoofing, stale SHA, replay and platform denial. Complete existing canonical tests, regressions and independent security review. Any failed test remains open, not silently declared PASS.

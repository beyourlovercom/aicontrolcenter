# AICC V2 Project Constitution

- Document ID: `AICC-V2-PROJECT-CONSTITUTION-001`
- Version: `1.1`
- Status: `APPROVED_BASELINE`
- Effective: `2026-08-13`

This is the highest project-level engineering authority for AICC V2.

## Precedence

`Project Constitution → Approved Baselines → Living Roadmap → Formal Work Package → Implementation → Tests → Human UAT`

A lower layer may not override a higher layer. A conflict is reported as
`BASELINE_CONFLICT` and execution stops until Owner-approved change control is
complete.

## Governing standards

- `AICC-V2-CODE-ARCHITECTURE-STANDARD-001`
- `AICC-V2-UI-INTERACTION-STANDARD-001`
- `AICC-V2-CANONICAL-EXECUTION-STANDARD-001`

## Constitutional rules

1. Every fact has one canonical owner.
2. Consumers read, project, render, persist evidence, or request decisions;
   they do not redefine or independently block/authorize.
3. AICC V2 uses one canonical Local Control Service.
4. Normal data changes do not require service restart; page load resolves live
   state automatically.
5. OpenCode, OpenSpec, and OmO are forbidden runtime dependencies.
6. A baseline change requires a `BASELINE_CHANGE_PROPOSAL`, version change, and
   explicit Owner approval.

## MVP delivery discipline

### Bug triage and UAT closure

AICC bugs have exactly three delivery severities:

- **P0 — CORE PATH BLOCKER**: a defect that prevents the current critical
  end-to-end path from being used or completed. P0 must be fixed before the
  affected MVP Work Package can close.
- **P1 — USABILITY DEFECT WITH WORKAROUND**: a defect that degrades usability,
  clarity, convenience, or recovery while the critical path remains usable
  through a reasonable workaround. P1 is recorded in Backlog and does not by
  itself delay MVP closure.
- **P2 — EDGE CASE / OPTIMIZATION / IDEAL ARCHITECTURE**: a non-blocking edge
  case, optimization, future-proofing improvement, or advanced recovery
  capability. P2 is recorded in Backlog and is not implemented in the first
  usable version unless explicitly promoted by Owner.

P0 is determined by impact on the current critical path, not by technical
interest, test exhaustiveness, architectural elegance, future Desktop needs,
or theoretical recovery quality. A genuine P0 receives the smallest systemic
root-cause fix needed to restore that path; `FIX_CURRENT_ROOT_CAUSE` does not
authorize `BUILD_IDEAL_FUTURE_ARCHITECTURE`.

For a Work Package already in Human UAT,
`NORMAL_MAX_P0_REMEDIATION_CYCLES = 1`. After the first P0 remediation cycle,
new P1/P2 findings, architecture improvements, and polish go to Backlog and do
not delay closure. A further cycle requires new real Owner evidence proving the
current critical path remains blocked. Every post-remediation UAT finding must
be classified P0/P1/P2 before action, and only a proven P0 may reopen the
closure gate.

Every future Work Package or UAT report must state:

`BUG_SEVERITY`, `BLOCKS_FIRST_USABLE_GATE`, `BLOCKED_GATE_ID`,
`REMEDIATION_CYCLE_NUMBER`, `CURRENT_WP_CLOSURE_BLOCKED`, and
`BACKLOG_IF_NOT_P0`.

### AICC V2 first usable version hard gates

The first usable version has exactly five hard product gates:

1. The AICC page opens and remains usable.
2. AICC remains idle for 10 minutes without automatic refresh, crash, or
   disappearance.
3. ChatGPT delivers an instruction to AICC successfully.
4. After one Owner Run click, Codex executes, reaches terminal completion, and
   the same AICC page displays `COMPLETED`.
5. The completed Run Report can be inserted back into ChatGPT.

If all five pass, `AICC_V2_FIRST_USABLE_VERSION = PASS`, the MVP Delivery Gate
closes, and remaining P1/P2 work moves to Backlog or the next Roadmap phase.
The first usable version must not remain open for unrelated non-blocking work.

Backlog records retain the finding, severity, affected area, workaround where
applicable, and recommended future phase. A Backlog finding has no execution
authority: `BACKLOG_FINDING_HAS_EXECUTION_AUTHORITY = 0`. Owner may explicitly
promote P1/P2 to P0, authorize an additional cycle, expand MVP scope, or require
architecture work before closure.

### Current GPT Bridge interpretation

`GPT_BRIDGE_001B_UAT_ROUND_2 = IN_PROGRESS`. Current idle-page instability is
P0 because it violates Gates 1 and 2 and may block Round 2. Formal Web Host /
Control Service separation, complete Desktop process isolation, and advanced
self-healing are P2 unless real Owner evidence proves they are necessary for
the five gates. This Constitution update does not authorize those expansions.

### Historical traceability

Version `1.0` was the approved baseline effective `2026-08-12`. Version `1.1`
is an Owner-approved governance update and preserves the meaning and history of
that prior baseline; it supersedes it without silently rewriting its record.

Current conformance is assessed separately from the approved status of this
document and its baselines.

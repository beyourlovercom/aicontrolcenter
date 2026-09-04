# AICC-V3-CANONICAL-RESULT-RETURN-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Add the smallest canonical Result layer for AICC V3 so one completed Run can produce one durable, reload-safe Result without AICC rewriting executor semantics.

## Authority

- Result identity derives from one exact durable Run.
- ProjectContext remains the repository authority.
- AICC transports and displays Result facts; it does not invent semantic PASS/FAIL.
- Raw executor evidence remains preserved as source evidence.

## In scope

- one canonical Result identity per Run;
- immutable Run→Result binding;
- durable project-scoped Result persistence;
- reload-safe Result retrieval;
- explicit source evidence references;
- focused tests and minimal UI only after contract/API gate;
- exact-head CI and Owner UAT.

## Out of scope

- GPT Bridge / auto return (V3.8);
- PR delivery (V3.7);
- retry/resume/fork;
- automatic merge/release/deploy;
- AICC semantic rewriting or inferred PASS/FAIL.

## Hard semantic boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`

## Frozen V3.6 contract

- Authority: `docs/40_Architecture/AICC-V3-CANONICAL-RESULT-CONTRACT.md`.
- Exactly one immutable Result may exist for one exact Run.
- Only persisted `EXITED` Runs are Result-eligible; exitCode is transport metadata, not a semantic gate.
- Content is the exact `item.text` from the highest-seq valid executor `item.completed / agent_message` event before `PROCESS_EXITED`.
- No trimming, summarization, translation, status inference, browser-authored Result content, or fallback source is allowed.
- Result storage is project-scoped inside the bound Run directory and validates current ProjectContext/worktree identity.
- Public V3.6 API is read-only: `GET /api/runs/:id/result`.

## Next exact gate

Implement the frozen Result persistence/materialization layer and read-only Result API with focused tests. Prove one Run→one Result, exact content/hash preservation, source-event linkage, project/worktree isolation, reload-safe retrieval, and fail-closed missing-source behavior before adding any Result UI.

# AICC V4 Production UAT — GitHub Read Latency Hotfix

Status: IMPLEMENTATION COMPLETE / DRAFT PR + EXACT-HEAD CI GATE
Source of Truth: `GitHub`
Work Package: `AICC-V4-PRODUCTION-UAT-GITHUB-LATENCY-HOTFIX-001`

## Trigger

Parallel V4 UAT on port 1421 exposed a real cold-path failure: `/api/projects` could exceed 20 seconds while individual `gh api` reads each remained under the existing 10 second per-call timeout.

## Root cause

Project facts used three serial network stages: repository metadata, default-branch commit, then PR/CI/Roadmap facts. High GitHub CLI latency therefore accumulated even though no single read timed out.

## Fix

- Read repository metadata, GitHub `HEAD` commit and open PRs concurrently.
- Keep `repo.default_branch` as the GitHub-provided branch identity.
- Keep the exact GitHub `HEAD` SHA as the projected default-branch head.
- Read exact-SHA CI and Roadmap evidence only after that head is resolved.
- Preserve request-scoped de-duplication and server in-flight coalescing.

## Verification

- V4 tests: `34/34 PASS`.
- Real A/B UAT: main 1421 and hotfix 1422 both returned 5/5 project views with identical exact SHAs.
- Hotfix path returned faster in the observed A/B run and removes one serial GitHub network stage by contract.
- Fresh three-machine observation remained read-only evidence.
- V3 production on 1420 remained healthy and untouched.

## Boundary

This hotfix does not deploy or cut over production. Port 1420 remains V3 until a separate explicit Owner authorization for V3 → V4 production cutover.

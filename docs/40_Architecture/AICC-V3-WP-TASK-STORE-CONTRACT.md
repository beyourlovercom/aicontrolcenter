# AICC V3 WP + Task Store Contract

Contract-Version: 1
Status: `FROZEN / V3.4`

## Purpose

Define the smallest durable project-scoped Work Package and Task store for AICC V3.

## Authority chain

`ProjectContext -> project-scoped store -> WP/Task APIs -> UI`

The store never discovers a repository. It receives the already validated active `ProjectContext`.

## Storage location

State root remains `~/.aicc-v3` (or `AICC_V3_HOME`).

Each project uses exactly one store:

`projects/<project-key>/work-store.v1.json`

`project-key` is a deterministic SHA-256 digest of `project.id + NUL + repository.identity`.
## Store envelope

```json
{
  "schema": "aicc.v3.work-store.v1",
  "revision": 1,
  "project": {
    "id": "aicc-v3",
    "repositoryIdentity": "beyourlovercom/aicontrolcenter"
  },
  "workPackages": [],
  "tasks": []
}
```

The persisted project binding must exactly match the active `ProjectContext` on every read and write.
A mismatch fails closed as `WORK_STORE_PROJECT_MISMATCH`.

`revision` starts at 1 and increments exactly once per successful mutation.
Writes use temp-file + rename replacement in the same directory.
No V2 state, repository file, browser cache, or Roadmap cache is a fallback source.

## Work Package model

Required fields: `id`, `title`, `status`, `createdAt`, `updatedAt`.
`id` is server-generated UUID and immutable.
Allowed Work Package status values:

`OPEN | ACTIVE | BLOCKED | DONE`

A create request must provide `title` and explicit `status`.
No API or UI may infer a Work Package status from Roadmap position, Task state, Git state, CI, or UAT.

## Task model

Required fields: `id`, `workPackageId`, `title`, `status`, `createdAt`, `updatedAt`.
`id` is server-generated UUID and immutable.
`workPackageId` is immutable after creation.

Allowed Task status values:

`TODO | IN_PROGRESS | BLOCKED | DONE | CANCELLED`

A create request must provide `workPackageId`, `title`, and explicit `status`.
The referenced Work Package must exist in the same store at write time.
A Task cannot be created detached, rebound, or cross-bound to another project.

## Minimal API contract

`GET /api/work` -> current project store projection.
`POST /api/work-packages` -> create one WP.
`PATCH /api/work-packages/:id/status` -> update only WP status.
`POST /api/tasks` -> create one Task bound to an existing WP.
`PATCH /api/tasks/:id/status` -> update only Task status.

No delete API, rebind API, bulk mutation API, or title-edit API exists in V3.4.

## Mutation rules

Server timestamps every create/status mutation in UTC ISO-8601.
`DONE` Work Packages are terminal.
`DONE` and `CANCELLED` Tasks are terminal.
Other allowed non-terminal statuses may move explicitly between allowed values.
Same-value status updates are rejected as `WORK_STATUS_UNCHANGED`.

Every mutation re-loads the active `ProjectContext` and validates the store binding before writing.

## Fail-closed errors

Invalid/missing store JSON -> `WORK_STORE_INVALID`.
Project binding mismatch -> `WORK_STORE_PROJECT_MISMATCH`.
Unknown WP -> `WORK_PACKAGE_NOT_FOUND`.
Unknown Task -> `TASK_NOT_FOUND`.
Invalid status -> `WORK_STATUS_INVALID`.
Terminal mutation -> `WORK_STATUS_TERMINAL`.
Missing Task WP -> `TASK_WORK_PACKAGE_NOT_FOUND`.

The browser only renders API facts and sends explicit create/status commands. It never derives lifecycle state.

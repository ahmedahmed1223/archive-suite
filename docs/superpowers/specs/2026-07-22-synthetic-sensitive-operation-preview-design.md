# V1-736 Synthetic Sensitive-Operation Preview Design

## Outcome

Archive Suite provides an Arabic, clearly labelled simulation environment for bulk deletion and trash restoration. Editors and administrators can execute both workflows against deterministic synthetic records, inspect before/after state and per-record outcomes, and learn the conflict/reversibility behavior without reading or mutating production `storage_rows` or `trashed_records` data.

## Safety Boundary

- Simulation data is generated in memory for every request from a fixed scenario identifier; it is never copied from user records.
- Preview execution does not query or write `storage_rows`, `trashed_records`, media storage, queues, audit logs, or external services.
- The simulation reuses a focused domain engine whose delete and restore rules match the production controllers: IDs are de-duplicated, missing records report failure, deletion moves an item to synthetic trash, restoration refuses a live UID conflict, and successful restoration removes the synthetic trash item.
- Responses include `synthetic: true`, a scenario identifier, operation, before/after counts, result rows, and expiry metadata. The UI repeats that no production data was touched.
- The endpoints require an authenticated editor or administrator. Viewers receive `403`.

## API

`GET /api/v1/safety-preview/scenarios` returns the supported deterministic scenarios and their Arabic descriptions.

`POST /api/v1/safety-preview/run` accepts:

```json
{
  "scenario": "restore-conflict",
  "operation": "restore",
  "ids": ["synthetic-conflict"]
}
```

The service generates the scenario, applies the requested operation in memory, and returns the full preview envelope. Supported scenarios cover a normal batch and a restore conflict. IDs are constrained to the generated scenario and the same 10,000-item upper bound as production bulk operations.

## Frontend

A canonical Next.js page at `/safety-preview` provides scenario, operation, and synthetic-item controls. It renders an operational-safety banner, before/after metric strip, per-record result table, and explicit synthetic-data notice. It never calls production bulk-delete or trash-restore endpoints. Navigation exposes the page only through the existing role-aware shell, while the API remains the authoritative authorization boundary.

## Contract and Verification

The OpenAPI document is updated first, generated bindings are refreshed, and the handwritten client exposes typed scenario and run methods. Laravel feature tests prove authentication, role denial, deterministic outcomes, conflict handling, validation, and database non-mutation. Next unit tests prove Arabic safety copy and response rendering; Playwright covers the user workflow with a mocked API. Root contract, generated-client, typecheck, Next test/build, and focused Laravel tests form the completion gate.


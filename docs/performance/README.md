# Performance measurements

[العربية](README.ar.md) · [Documentation](../README.md)

Archive Suite uses a reproducible performance contract for the supported
Docker and direct-host (Native) runtimes. The machine-readable source is
[`baseline.v1.json`](baseline.v1.json); it defines the resource profile,
dataset size, routes, API operations, and performance budgets.

## What is measured

| Area | Measurements |
| --- | --- |
| Browser | LCP P75, CLS P75, and INP P75 across the declared viewports |
| API | Search, record-open, and upload-session-start latency at P95 |
| Environment | Operating system, CPU, memory, and container constraints |

The collector rejects a run when its observed environment does not match the
declared profile. This prevents results from a faster workstation from being
reported as release measurements.

## Run the measurement

Generate the deterministic dataset, collect browser and API samples, then run
the regression gate:

```bash
MSYS_NO_PATHCONV=1 node scripts/laravel-docker.mjs artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json
E2E_BASE_URL=http://localhost:3000 pnpm --filter @archive/next exec playwright test e2e/performance-baseline.authed.spec.ts --project=authenticated
node scripts/performance-collect.mjs docker docs/performance/runs/frontend-events.json docs/performance/runs/api-events.json docs/performance/runs/run.docker.json
node scripts/performance-regression.mjs docs/performance/runs/run.docker.json
```

Use `native` instead of `docker` for a direct-host run. Each run must contain at
least 20 samples per required measurement.

## Results and evidence

Generated files under `docs/performance/runs/` are intentionally not committed.
Keep the result JSON, resource profile, source commit, image or package
checksums, and dataset manifest together in the release evidence store. A run
passes only when every measurement stays within the budgets in
`baseline.v1.json`.

# Performance measurements

[العربية](README.ar.md) · [Documentation](../README.md)

Archive Suite uses a reproducible performance contract for the supported
Docker and direct-host (Native) runtimes. The machine-readable source is
[`baseline.v1.json`](baseline.v1.json); it defines the resource profile,
dataset size, routes, API operations, and performance budgets.

## What is measured

| Area | Measurements |
| --- | --- |
| Browser | LCP, CLS, INP, and JavaScript transfer size at P75 across the declared viewports |
| API | Search, record-open, upload-session-start, and Studio-open latency at P95 |
| Workflow | Preview startup and queue latency at P95 |
| Environment and data | Operating system, CPU, memory, container constraints, and the generated dataset manifest |

The collector rejects a run when its observed environment or dataset evidence
does not exactly match the declared profile. This prevents results from a
faster workstation, or a smaller benchmark dataset, from being reported as
release measurements. It records only supplied observations; it never creates
or substitutes measurements.

## Run the measurement

Run this only on Ubuntu 24.04 x64 with 4 vCPU and 8 GiB. Generate the
deterministic dataset and keep its JSON output as evidence outside Git. Then
collect 20 or more samples for every metric listed in
`measurement.requiredMetrics` (including Studio, preview, JavaScript bytes,
and queue latency) and run the regression gate:

```bash
MSYS_NO_PATHCONV=1 node scripts/laravel-docker.mjs artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json > docs/performance/runs/dataset-manifest.json
E2E_BASE_URL=http://localhost:3000 pnpm --filter @archive/next exec playwright test e2e/performance-baseline.authed.spec.ts --project=authenticated
node scripts/performance-collect.mjs docker docs/performance/runs/dataset-manifest.json docs/performance/runs/frontend-events.json docs/performance/runs/api-events.json docs/performance/runs/run.docker.json
node scripts/performance-regression.mjs docs/performance/runs/run.docker.json
```

Use `native` instead of `docker` for a direct-host run. The collector refuses
to write a run artifact for an unapproved environment, incorrect dataset, or
invalid event data. Each run must contain at least 20 samples per required
measurement; the regression gate repeats that check before accepting evidence.

## Results and evidence

Generated files under `docs/performance/runs/` are intentionally not committed.
Keep the result JSON, resource profile, source commit, image or package
checksums, and dataset manifest together in the release evidence store. A run
passes only when every measurement stays within the budgets in
`baseline.v1.json`. Do not create a run artifact from invented values or label
local development measurements as a release baseline.

# Load Tests (k6)

Performance tests for Archive Suite server.

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

## Running

# Baseline (10 VUs, 1 minute)
k6 run load-tests/baseline.js

# Peak load test
k6 run --env TARGET=peak load-tests/baseline.js

# Spike test
k6 run --env TARGET=spike load-tests/baseline.js

# With authentication
k6 run --env AUTH_TOKEN="your_jwt_token" load-tests/baseline.js

# Against staging
k6 run --env BASE_URL="https://staging.example.com" --env AUTH_TOKEN="..." load-tests/baseline.js

## Thresholds (Baseline)

| Metric | Target |
|--------|--------|
| p95 response time | < 500ms |
| p99 response time | < 1000ms |
| Error rate | < 1% |
| Throughput | >= 10 req/s per VU |

## Results

Results are saved to `load-tests/results/summary.json` after each run.

# Service extraction thresholds

[العربية](service-extraction-thresholds.ar.md) · [Documentation](../README.md)

[`service-extraction-thresholds.v1.json`](service-extraction-thresholds.v1.json)
defines the evidence required before separating media work or adopting a
transactional outbox. Crossing a threshold triggers a review; it does not
change the architecture automatically.

## Evidence collection

- Use at least 14 days and 1,000 jobs or events.
- Record the source commit, resource profile, dataset size, and measurement window.
- Use production measurements or a reproducible production-like benchmark.
- Exclude permanent input errors from retryable-failure rates.
- Keep raw results and the reviewed summary together.

## Decisions

A media worker requires at least two threshold signals. Laravel retains
scheduling, public API behavior, job state, and audit ownership. Any worker must
consume a versioned contract and return idempotent results.

An outbox decision requires a qualifying delivery, volume, or contractual
signal from the JSON contract. The design must include idempotency, bounded
replay, retention, dead-letter handling, and age/attempt/failure measurements.

## Review and reversal

Architecture, Operations, and Product record the evidence, cost, success
measure, and one decision: `remain-modular`, `extract-worker`, or
`adopt-outbox`. Review the result after 14 days. If reliability or service-level
objectives do not improve, route the work back through the modular Laravel
implementation while preserving the versioned contract and audit log.

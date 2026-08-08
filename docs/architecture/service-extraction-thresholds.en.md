# Service extraction thresholds

[العربية](service-extraction-thresholds.md) · [Documentation](../README.md)

The machine-readable contract in `service-extraction-thresholds.v1.json`
defines the evidence required before separating media work or adopting an
outbox. Laravel remains the owner of scheduling, state, audit data, and the
public API; any worker consumes a versioned contract and must be idempotent.

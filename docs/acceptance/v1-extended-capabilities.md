# V1 extended-capability live acceptance

`V1-X01` through `V1-X04` are release blockers. The local preflight creates a
redacted, **not-executed** evidence template; it does not connect to any
provider and can never mark a capability as passed.

Run `pnpm acceptance:extended:preflight -- --env-file <operator-env> --output <new-evidence-file>` only on the target host. The output must remain outside source control. A live operator attaches command transcripts, metric exports, checksums, and the evidence file to the RC record, then changes each individual run to `passed` only after its required evidence is present.

| Task | External blocker required before a live pass |
| --- | --- |
| V1-X01 | A non-production S3/Dropbox provider, dedicated least-privilege credentials, and a large test object. |
| V1-X02 | Clean Windows host, installed driver, DSN, and dedicated test database with allowlisted and denied tables/roles. |
| V1-X03 | Target GPU host with `nvidia-smi`, CUDA runtime, approved Arabic corpus, and a resource-metrics collector. |
| V1-X04 | Live AI/vision credential, Postgres with pgvector, isolated tenant/index, and enforceable timeout/rate/cost limits. |

Credentials, DSNs, provider URLs, user paths, source media, and raw model output must not be copied into evidence. The preflight marks each configured variable as a boolean and sanitizes any accidental secret values.

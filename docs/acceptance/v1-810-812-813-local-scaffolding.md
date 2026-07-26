# V1-810 / V1-812 / V1-813 — local acceptance scaffolding

The registry deliberately distinguishes an executable plan from acceptance
evidence. `V1-IA-MEDIA-001` models the montage journey: source from a
search/group, timeline editing and review, transcode/transcription, retry and
cancel, export checksum, then explicit recovery from worker, FFmpeg, or disk
failure. Its required evidence includes the job log and export checksum.

`V1-IA-LOAD-001` is bound to
[`v1-812.dataset.json`](datasets/v1-812.dataset.json). A real run must invoke
`archive:generate-benchmark-dataset` with its exact seed and record the
generated dataset manifest, concurrent-load metrics, queue metrics, and
integrity/checksum report. This repository does not check in generated 1 GiB
test data or treat the recipe as a successful load run.

`scripts/acceptance/gates.mjs` defines the daily, nightly, RC, and GA
selections. Daily/nightly can record `blocked-capability` as visible evidence;
RC and GA fail whenever a selected scenario is blocked, missing, or failed.
GA additionally requires signed artifacts and must be run from those artifacts
on clean hosts, with no new build.

## Current external blockers

The local Docker provider cannot advertise `media-worker`, `ffmpeg`,
`load-baseline`, `automation`, `clean-host`, native Windows/Linux, or
`signed-artifacts`. Until a provider proves each capability with sanitized
evidence, the corresponding scenarios remain `blocked-capability` rather than
passing. Clean-host ownership and the required evidence are tracked in
[`docs/ops/acceptance-clean-host-blockers.md`](../ops/acceptance-clean-host-blockers.md).

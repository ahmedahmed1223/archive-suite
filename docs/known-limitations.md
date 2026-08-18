# Known Limitations

[العربية](known-limitations.ar.md) · [Documentation](README.md)

A single, maintained list of limitations that are known, deliberate, or
require operator action — as opposed to open bugs. Each entry names the
constraint and, where relevant, the path to lifting it.

## Deployment

- **GPU-accelerated Whisper transcription** requires a CUDA/cuDNN-capable
  worker image. The shipped `archive-laravel/Dockerfile.worker` image has no
  CUDA runtime, so `WHISPER_DEVICE=cuda` fails even on a host with a real
  GPU. `Dockerfile.whisper-gpu-acceptance` documents the working recipe for
  operators who want to build their own GPU variant. CPU with `int8` compute
  is the supported default.
- **SQL Server ODBC connectivity** requires the operator to add Microsoft's
  proprietary `msodbcsql` driver to the worker image themselves (not
  bundled by default: EULA acceptance and image-size cost). PostgreSQL
  (`odbc-postgresql`) and MySQL/MariaDB (`odbc-mariadb`) drivers ship by
  default. Oracle is explicitly out of scope for the ODBC bridge.
- **The performance budget gate** (six documented budgets) has never
  recorded a baseline run. It requires a CI runner matching the documented
  profile (Ubuntu 24.04, 4 vCPU, 8 GiB), which is not available in every
  environment.

## Frontend

- **Arabic-first UI text** is still embedded inline (not routed through the
  shared dictionary layer) in most pages; only the shell, auth, and a
  handful of other surfaces are fully localized through `useLocale`. A full
  migration is scoped but not complete.
- **`'use client'` usage** has not been audited for components that could be
  server components instead — roughly half of all component files carry the
  directive, some of it likely more than the component actually needs.

## Dependencies

- **`leaflet` is pinned to `^1.9.4`**, one major version behind upstream.
  The nine `@ai-sdk/*` packages (`anthropic`, `deepseek`, `google`, `groq`,
  `mistral`, `openai`, `openai-compatible`, `xai`) are kept in lockstep on
  the same `4.0.x`/`3.0.x` line by design — they share one internal
  provider interface, so they are upgraded together, not independently.
  No upgrade is scheduled; bump either group only after checking upstream
  breaking-change notes for the new major/minor line.

## Media and workflow

- **External review link watermarking** displays a visible label over the
  media in the public viewer; it does not burn a mark into the video or
  image pixel data. A downloaded or re-recorded copy will not carry it.
- **Derivative generation** (thumbnails, waveforms, proxies) always runs on
  the same CPU queue as other media operations. Only transcription can route
  to the GPU queue, and only when the system Whisper device is set to
  `cuda`.
- **Work inbox** has no true per-department isolation: every source it
  aggregates is scoped to the current user except rights nearing expiry,
  which has no per-user or per-department owner anywhere in the schema and
  is gated behind the same content-management permission that already
  governs it elsewhere. A department membership model would be required to
  narrow this further.
- **Vocabulary term relink** (Types → Relink) scans every archive record to
  find ones carrying the term being replaced. This is fine at the scale of
  an infrequent administrative action, but it is a full scan, not an
  indexed lookup, so it will slow down as the archive grows very large.

## Backend

- **`embeddings:sync`** retries transient network failures by silently
  logging and moving on (no exponential backoff) — a deliberate choice
  distinct from the spend/rate cap it does enforce.
- **Legacy `Crypt::encrypt()`-format backups** created before the streamed
  AES-256-GCM encryption format remain readable, but are not automatically
  detected independent of the current `archive.backups.encryption_enabled`
  setting — the same ambiguity that existed before streamed encryption was
  added.

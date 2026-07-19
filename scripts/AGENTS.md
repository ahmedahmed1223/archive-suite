# Repository Scripts Agent Guidance

This file extends the repository-root `AGENTS.md` for work under `scripts/`.

## Safety and ownership

- Root scripts are orchestration and release infrastructure; keep them deterministic, non-interactive by default, and safe on Windows and Linux.
- Prefer argument arrays with `shell: false`; never interpolate user-controlled values into shell commands.
- A script may stop, remove, or reset only resources it created or resources explicitly named and approved by the user.
- Docker resources must use unique project/run labels and cleanup in `finally`; prove absence after cleanup when the workflow is destructive.
- Diagnostic commands such as `agent:doctor` must remain read-only.
- Evidence must live outside source directories, be sanitized, leak-scanned, and owner-restricted where supported.

## Testing and interfaces

- Use `node:test` for script contracts and dependency injection for process/filesystem boundaries.
- Follow red-green-refactor for behavior changes and exercise failure paths, cleanup, and exit codes.
- Keep stable CLI syntax documented in `README.md` or the owning operational guide.
- Do not silently weaken a gate because Docker, credentials, a VM, or another capability is unavailable; report the capability as blocked.

Use `docs/agents/verification-matrix.md` to select the complete gate for the change.

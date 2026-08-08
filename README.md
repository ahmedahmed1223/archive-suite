# Masar / مسار

[العربية](README.ar.md) · [Documentation](docs/README.md)

**مسار** نظام مركزي لإدارة الأصول الأرشيفية والإعلامية. يوفّر سجلًا موحّدًا للمواد
وبياناتها الوصفية، وإدارة للملفات والبحث والمراجعة والتعاون، مع ضوابط للصلاحيات
والتدقيق. صُمم لفرق الأرشفة والتحرير والإنتاج لتنتقل المادة من الاستلام إلى
الاستخدام ضمن سير عمل واضح وقابل للتوسع.

## Release status

[`v1.0.0`](docs/release-notes/v1.0.0.md) is the first General Availability
release. It passed the full release gate (`pnpm release:verify`) and is covered
by the support window in [docs/versioning.md](docs/versioning.md).

Masar v1.0.0 is generally available. The release notes describe the changes,
operator guidance, and support policy for this version.

- [Features and usage guide](docs/features-guide.md)
- [Launch and support guide](docs/ops/rc-launch-and-support.md)
- [Clean release rehearsal](docs/ops/v1-505-release-rehearsal.md)
- [Release and GA operations](docs/release/v1-601-605-ga-operations.md)

## System overview

- A unified archival record for assets, metadata, classifications, tags, and
  approval state.
- Independent file management for uploading, organizing, moving, and finding
  files before an operator chooses to archive them.
- Advanced search and filters by type, classification, tag, date, and work
  status.
- Reviews, comments, tasks, and projects to follow an asset from intake to
  delivery.
- Human-reviewed assistance for transcription, summaries, tag suggestions, and
  entity extraction.
- Role-based access, audit trails, operational reporting, and extensible
  storage configuration.

## Canonical architecture

This repository is a monorepo. The canonical development path is **Next.js +
Laravel**:

- `archive-next/` — canonical `Next.js` and `TypeScript` frontend.
- `archive-laravel/` — canonical `Laravel` backend and API.
- `docs/api/archive-contract.openapi.json` — canonical `OpenAPI` contract
  shared by the frontend and backend.

See [CLAUDE.md](CLAUDE.md) for workspace architecture and development workflows.

## Start here

### Requirements for local development

- `Node.js 26.5.0`
- `pnpm 11.9.0`
- `Docker Desktop` with Docker Compose

`PHP 8.5.8` and `Composer 2.10.2` run inside Docker, so they are not required
on the development host. The supported toolchain is pinned in
`infra/platform/toolchain.v1.json`.

### Install and run

Run the following commands from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts Laravel in Docker and Next.js locally. Run either component
alone when needed:

```powershell
pnpm dev:next
pnpm dev:laravel
```

### Verify before review or merge

```powershell
pnpm verify
pnpm verify:laravel-next:live
```

`pnpm verify` is the canonical project gate for API contracts, types, builds,
tests, and repository hygiene. `pnpm verify:laravel-next:live` runs the live
Laravel and Next.js integration check.

## Deployment and configuration

`Control Center` provides local Docker-based setup and deployment:

```powershell
pnpm setup
pnpm deploy
```

These commands run the application from source in your environment; they are
not a substitute for a downloadable release artifact. See
[DEPLOYMENT.md](DEPLOYMENT.md) and [Control Center](docs/control-center.md)
for Docker deployment, environment variables, administrator credentials, and
cloud-storage configuration.

Supported storage includes local disk, `Dropbox`, `S3`, `Azure Blob`,
`Google Drive`, `FTP/FTPS`, `SMB/CIFS`, `SFTP/SSH`, and `WebDAV`.

## Contributing

- Use `pnpm` from the repository root.
- Update the `OpenAPI` contract, frontend, and backend together when changing a
  public interface.
- Run `pnpm verify` before opening a `Pull Request`.
- Keep new product work in `archive-next/` and `archive-laravel/`.

See [CLAUDE.md](CLAUDE.md) for architecture, testing, CI/CD, and contribution
workflows.

## Support

For operational support or incident reporting, start with the
[support guide](docs/ops/rc-launch-and-support.md). Include
reproduction steps, an approximate timestamp, and redacted logs only.

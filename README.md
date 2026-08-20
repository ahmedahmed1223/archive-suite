# Archive Suite / مسار

[العربية](README.ar.md) · [Documentation](docs/README.md)

**مسار** نظام مركزي لإدارة الأصول الأرشيفية والإعلامية. يوفّر سجلًا موحّدًا للمواد
وبياناتها الوصفية، وإدارة للملفات والبحث والمراجعة والتعاون، مع ضوابط للصلاحيات
والتدقيق. صُمم لفرق الأرشفة والتحرير والإنتاج لتنتقل المادة من الاستلام إلى
الاستخدام ضمن سير عمل واضح وقابل للتوسع.

## Release status

[`v1.3.1`](docs/release-notes/v1.3.1.md) is the current General Availability
release and is covered by the support window in [docs/versioning.md](docs/versioning.md).

Archive Suite v1.3.1 is generally available. The release notes describe the changes,
operator guidance, and support policy for this version.

- [Features and usage guide](docs/features-guide.md)
- [Operations and support guide](docs/ops/support.md)

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

## Supported architecture

This repository is a monorepo. The supported development path is **Next.js +
Laravel**:

- `archive-next/` — supported `Next.js` and `TypeScript` frontend.
- `archive-laravel/` — supported `Laravel` backend and API.
- `docs/api/archive-contract.openapi.json` — shared `OpenAPI` contract
  shared by the frontend and backend.

See the [documentation index](docs/README.md) for architecture and development references.

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

`pnpm verify` is the project gate for API contracts, types, builds,
tests, and repository hygiene. `pnpm verify:laravel-next:live` runs the live
Laravel and Next.js integration check.

## Deployment and configuration

`Control Center` provides guided setup and operation. Docker deployment uses the
canonical [infra/docker-compose.yml](infra/docker-compose.yml):

```powershell
pnpm setup
pnpm deploy
```

These commands run the application from source in your environment; they are
not a substitute for a downloadable release artifact. See
[DEPLOYMENT.md](DEPLOYMENT.md) and [Control Center](docs/control-center.md)
for Docker deployment, environment variables, administrator credentials, and
cloud-storage configuration.

Direct-host operation (Native) is supported on Windows and Linux through
signed release assets. See [Native installation](docs/native-installation.md)
for download, checksum, service, and verification guidance, and
[Whisper transcription](docs/whisper.md) for CPU and GPU requirements.

Supported storage includes local disk, `Dropbox`, `S3`, `Azure Blob`,
`Google Drive`, `FTP/FTPS`, `SMB/CIFS`, `SFTP/SSH`, and `WebDAV`.

## Contributing

- Use `pnpm` from the repository root.
- Update the `OpenAPI` contract, frontend, and backend together when changing a
  public interface.
- Run `pnpm verify` before opening a `Pull Request`.
- Keep new product work in `archive-next/` and `archive-laravel/`.

See the [documentation index](docs/README.md) for architecture, testing, CI/CD,
and contribution references.

## Support

For operational support or incident reporting, start with the
[support guide](docs/ops/support.md). Include
reproduction steps, an approximate timestamp, and redacted logs only.

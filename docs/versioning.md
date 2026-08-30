# Versioning and support policy

[العربية](versioning.ar.md) · [Documentation](README.md)

Archive Suite follows Semantic Versioning: `MAJOR.MINOR.PATCH`.

- `MAJOR` changes may break the public API contract, data format, or backup format.
- `MINOR` releases add backward-compatible capabilities.
- `PATCH` releases contain backward-compatible fixes.
- Prerelease identifiers are published under their exact tag and do not move `latest`.

The `version` in `package.json` is the software version source of truth. A
release is published from a matching `v<version>` Git tag after the release
verification gate succeeds.

## Support window

| Release line | Support |
| --- | --- |
| Latest minor in the latest major | Full fixes and security updates |
| Immediately previous minor | Security fixes for six months after the next minor ships |
| Older lines | Upgrade required |
| Prerelease builds | No support commitment |

Schema and backup formats remain compatible within a major version unless the
release notes provide an explicit upgrade procedure.

## Operator policy

Read the release notes before updating, create and verify a backup, and retain
the previous version's compatible backup until health checks pass. Use Control
Center for updates and recovery.

For a Native Standalone install, read the installed version and UTC build time
from `RELEASE.json` at the bundle root. The matching `CHANGELOG.md` contains
the release history shipped with that bundle; the signed GitHub Release notes
remain the canonical public history.

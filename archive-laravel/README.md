# Archive Suite Laravel backend

[العربية](README.ar.md) · [Documentation](../docs/README.md)

This package owns Archive Suite's API behaviour, persistence, authorisation, queues,
realtime services, and audit trail. The supported frontend is `archive-next`;
the shared public contract is `../docs/api/archive-contract.openapi.json`.

## Develop and verify

Run these commands from the repository root. Docker supplies PHP and Composer.

```bash
pnpm dev:laravel
pnpm verify:laravel
pnpm verify:laravel-next:live
```

When a public API changes, update OpenAPI, Laravel, and the Next.js client in
the same change. Keep authorisation in the server and test the affected role or
ownership boundary.

See [API documentation](../docs/api/README.md) and [backend reference](BACKEND.md).

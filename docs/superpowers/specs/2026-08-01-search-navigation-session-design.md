# Search, Navigation, and Session Design

## Goal

Make search faster to operate, navigation easier to scan, and the login persistence choice explicit and real.

## Design

The search route remains one page and uses the existing API. Its controls are arranged as a responsive workbench: the query and primary actions lead; optional filters sit in a native disclosure; saved searches and recent searches form separate, labelled strips; results retain the existing card/list switcher. This is an Arabic-first functionalist layout: a strict grid, restrained brand colour, and no new dependencies.

The primary sidebar keeps the existing role-aware daily routes, but renders the remaining routes as labelled native disclosures. The active group opens automatically. Users can open, close, or reset the groups locally without changing navigation permissions.

The login form offers `rememberMe`. Without it, the refresh and presence cookies are session cookies and disappear when the browser closes. With it, they persist for the configured refresh lifetime. The Laravel session row retains that boolean through token rotation so refreshes preserve the selected behaviour.

## Constraints

- Work only in `archive-next/`, `archive-laravel/`, and `docs/api/`.
- Update OpenAPI, generated client types, Next client, and Laravel API together.
- Use existing CSS tokens, native `<details>`, and no new dependencies.
- Keep all Arabic UI copy natural and operational.
- Preserve responsive behaviour from 375px upward and keyboard access to all controls.

## Validation

- Laravel feature tests prove session-only and remembered cookies, including refresh rotation.
- Next unit tests prove the explicit login payload and navigation disclosure behaviour.
- Typecheck, contract generation verification, and a headed browser sweep cover login, search, and navigation.

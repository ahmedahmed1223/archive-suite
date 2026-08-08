# Application Localization, Help, and User Guide Design

**Date:** 2026-08-08  
**Status:** Draft for user review  
**Scope:** Archive Suite canonical Next.js and Laravel application

## Objective

Archive Suite will provide complete Arabic and English user interfaces. A user
selects a language in Settings, the preference follows that account across
devices, and the application applies the corresponding document language and
direction before rendering. Visitors without an account preference use the
browser language when it is Arabic or English, with Arabic as the fallback.

The same localization system will power `/help`, the role-aware in-app guide,
and the public user guide. The English option must not be exposed as complete
until every supported route passes the localization coverage gate.

## Current-state findings

- `archive-next/app/layout.tsx` fixes the document to `lang="ar"` and `dir="rtl"`.
- Settings displays “اللغة: العربية” as read-only text; it does not save a
  language preference.
- Most interface strings are Arabic literals inside components and pages.
- The authenticated user contract has no locale field.
- `/help` has four short Arabic chapters stored in Markdown.
- `/api/guide` correctly filters chapters by the authenticated role, but it has
  no locale input or localized error response.
- The guide renderer supports paragraphs, H2 headings, and simple lists only.

## Design principles

1. One component tree serves both languages; components are never duplicated
   by locale.
2. Public routes remain unchanged. Locale is state, not a URL prefix.
3. Every visible static string comes from a typed translation namespace.
4. User-provided content is never translated automatically.
5. Authorization is evaluated before localized guide content is returned.
6. Machine error codes are translated in Next.js; backend prose is not shown
   directly as localized interface copy.
7. Arabic is authored naturally in Modern Standard Arabic, not translated word
   for word from English.

## Locale model and precedence

The supported locale type is `"ar" | "en"`. The database user field is
nullable to preserve the distinction between an explicit account preference
and a user who has not selected a language.

The effective locale uses this order after session reconciliation:

1. authenticated account locale when non-null;
2. `archive_locale` cookie;
3. browser `Accept-Language` when it resolves to Arabic or English;
4. Arabic fallback.

On the first server request the account is not yet available to Next.js, so the
server resolves only the cookie, request language, and fallback. The account
locale is reconciled immediately after session bootstrap and becomes the cookie
value used by subsequent server requests.

`localStorage` stores the most recent local choice as a recovery hint. It never
overrides a non-null account locale. The locale cookie is non-sensitive,
`SameSite=Lax`, and readable by the client so Settings can update it
immediately.

When login or session refresh returns an account locale that differs from the
current locale, the application updates the cookie and local state, then
refreshes the current route once. A loop guard prevents repeated refreshes.

## API and persistence

Add a nullable `locale` column to `users`, constrained by application
validation to `ar` or `en`.

The OpenAPI `User` schema gains:

```json
"locale": { "type": ["string", "null"], "enum": ["ar", "en", null] }
```

Add the authenticated endpoint:

```text
PATCH /api/v1/account/preferences
```

Request:

```json
{ "locale": "en" }
```

Response:

```json
{ "ok": true, "user": { "id": "...", "role": "editor", "locale": "en" } }
```

The endpoint updates only the requesting user, validates the locale strictly,
and emits the existing audit envelope for account preference changes. Login,
refresh, and `/auth/me` return the locale through the shared user formatter.

## Next.js localization architecture

Create a localization package under `archive-next/lib/i18n/`:

- `types.ts`: `AppLocale`, namespace names, and typed key helpers.
- `resolve-locale.ts`: cookie, header, browser, and account precedence.
- `dictionaries/ar/` and `dictionaries/en/`: feature-scoped dictionaries.
- `LocaleProvider.tsx`: current locale, direction, translator, and update API.
- `LocaleAccountSync.tsx`: reconciliation between authenticated user and locale.
- `format.ts`: locale-aware dates, numbers, sizes, and relative time.

Dictionaries are separated into `shell`, `auth`, `settings`, `help`, `archive`,
`files`, `search`, `collaboration`, `media`, `operations`, and `shared`.
Arabic and English must expose the same keys; TypeScript compilation fails when
a key is missing.

`LocaleProvider` wraps `AuthProvider` so authentication and session states can
translate their messages. `LocaleAccountSync` is rendered inside both providers
and performs the account reconciliation without creating a dependency cycle.

The request locale is forwarded by `proxy.ts`. The root layout sets `lang` and
`dir` before rendering. This makes the authenticated application request-aware
instead of fully static; correctness and prevention of mixed-direction output
take priority over static generation for these operational pages.

CSS changes use logical properties where direction matters. Exact technical
values, paths, identifiers, and code remain `dir="ltr"` in both languages.

## Settings experience

Settings includes an editable language control with Arabic and English choices.
Changing it:

1. previews the selected language immediately;
2. sends `PATCH /account/preferences` for an authenticated user;
3. updates the cookie and local recovery value after success;
4. refreshes server-rendered content once;
5. restores the previous locale and shows a localized error if saving fails.

The control is keyboard accessible and announces success or failure. It is not
shown as a completed product capability until the whole-application coverage
gate passes.

## Help center information architecture

`/help` becomes the searchable user guide, not a static collection of feature
cards. It retains role filtering and adds these chapter families:

| Chapter | Viewer | Editor | Admin |
| --- | ---: | ---: | ---: |
| Getting started and navigation | yes | yes | yes |
| Search, saved searches, and records | yes | yes | yes |
| Files, previews, and downloads | yes | yes | yes |
| Rights and sharing | yes | yes | yes |
| Uploads and metadata | no | yes | yes |
| Collections, projects, and collaboration | no | yes | yes |
| Media processing and review | no | yes | yes |
| Users, roles, and permissions | no | no | yes |
| Settings, storage, and integrations | no | no | yes |
| Backup, recovery, health, and support | no | no | yes |
| What is new in the current release | yes | yes | yes |

Each chapter includes an outcome, prerequisites, numbered procedure, safety or
permission notes, verification, and a link to the relevant application page.
The guide does not expose internal plans, acceptance evidence, unfinished work,
or historical delivery phases.

## Localized guide content

Guide files follow the public documentation naming convention:

```text
content/guide/getting-started.md       # English
content/guide/getting-started.ar.md    # Arabic
```

The manifest stores a source stem rather than one filename. `getGuideChapters`
accepts a role and locale, reads only the requested locale, and filters the
authorized manifest entries before reading file bodies. This ordering prevents
restricted chapter bodies from entering an unauthorized response.

`GET /api/guide` derives the account role and locale from `/auth/me`. It accepts
an explicit `locale=ar|en` only when the account locale is null; otherwise the
account locale wins. The response contains one language and uses `no-store`.

Search uses locale-aware normalization. Arabic normalization handles common
letter variants and diacritics; English search uses case-insensitive matching.

## Markdown rendering

Replace the ad hoc line parser with a safe renderer that supports:

- H2 and H3 headings;
- ordered and unordered lists;
- links restricted to safe application-relative or HTTPS targets;
- inline code and fenced code blocks;
- emphasis, tables, and callout blocks;
- no raw HTML execution.

Heading anchors are stable and locale-specific. Keyboard focus moves to the
selected chapter heading, and search result counts are announced in the active
language.

## Whole-application migration

Migration proceeds by functional surfaces while keeping one final release gate:

1. localization runtime, account contract, layout, shell, authentication, and Settings;
2. Help and the complete role-aware user guide;
3. archive, search, records, files, uploads, and rights;
4. collections, projects, collaboration, media, and automation;
5. administration, integrations, operations, reports, errors, and remaining routes.

The English selector remains hidden behind the localization-complete gate until
all five groups pass. Development previews may enable it explicitly for testing.

## Error handling

- Preference save failure restores the previous locale and preserves the
  existing account value.
- An invalid cookie or local value is ignored and replaced by locale resolution.
- A missing dictionary key fails tests and production build.
- A missing localized guide file fails the guide-content test and build.
- An unknown backend error code uses a localized generic message and logs the
  request identifier; raw backend prose is not displayed.
- Guide authentication failure returns a localized generic message without
  revealing whether a restricted chapter exists.

## Verification

Required automated coverage:

- Laravel migration, model, request validation, controller, authorization, and
  audit tests for account locale.
- OpenAPI and generated-client coherence tests.
- Locale resolution precedence and invalid-value tests.
- Provider tests for immediate switching, rollback, and account reconciliation.
- Root `lang`/`dir` tests for Arabic and English.
- Dictionary key parity and static visible-string coverage.
- Locale-aware date, number, and size formatting tests.
- Guide manifest pair, role isolation, locale isolation, search, and broken-link tests.
- Markdown safety and accessibility tests.
- Playwright journeys for visitor detection, account persistence across login,
  Settings switching, RTL/LTR navigation, and role-specific Help content.
- Visual regression snapshots for representative Arabic and English pages at
  mobile, tablet, and desktop widths.

## Completion criteria

The work is complete when:

- the Settings language control persists to the account and applies immediately;
- visitors resolve Arabic or English from the browser with Arabic fallback;
- all supported application routes render complete Arabic and English static copy;
- HTML language and direction match the active locale before visible content;
- Help presents the complete authorized user guide in the active locale;
- no guide response contains another role's restricted body or both languages;
- public documentation links remain bilingual and valid;
- localization, contract, Next.js, Laravel, accessibility, and visual gates pass.

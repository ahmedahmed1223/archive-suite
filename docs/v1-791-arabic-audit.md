# V1-791 Arabic audit: Laravel strings, notifications, and icon direction

Date: 2026-07-28
Scope: the two halves of V1-791 that were still open after the Next.js UI-text
pass — (a) Laravel's user-facing strings and notifications, (b) the RTL
icon-direction sweep across `archive-next`.

Source-level audit. No live Arabic proofreading session is included here; the
findings below are about *which language reaches the user*, not about the
wording quality of text that is already Arabic.

## Findings

### A1 — P1 — Every API error reaches the Arabic UI in English

`archive-laravel` has no `lang/` directory of its own, and every
`{ok:false, error}` envelope carries an English sentence: "Record not found.",
"This upload can no longer be cancelled.", "Resource is locked by another
collaborator.", and 60 more. A static scan of `app/Http/Controllers/Api/V1`
counts **63 literal `'error' => '…'` strings, all English**.

On the Next.js side, `lib/archive-api.ts` translates exactly two of them:

```ts
const AUTH_ERROR_MESSAGES_AR: Record<string, string> = {
  "Invalid credentials.": "بيانات الدخول غير صحيحة.",
  "Unauthorized.": "انتهت الجلسة. سجّل الدخول مرة أخرى."
};
```

`translateKnownApiError()` passes anything else through verbatim, so an Arabic
user who deletes a missing record sees "Record not found." inside an RTL
Arabic page. Only the login form has a safety net — `localizeLoginError()`
falls back to a generic Arabic sentence when the string contains no Arabic
characters.

**The blocker recorded in the code is stale.** The comment above
`translateKnownApiError` says a full translation layer "needs backend error
codes first". Those codes now exist: V1-815 added `app/Support/ApiError.php`
plus `tests/Unit/ApiErrorCodeGuardTest.php`, a static scan that fails the build
if any manually-built `{ok:false}` response omits a `code`. Re-running the same
±4-line check over the V1 controllers today: **63 of 63 error responses carry a
`code`; none is missing one.** The distinct codes are 26 in total, dominated by
`not_found` (35 sites), then `unsafe_file_content` (4), `session_not_found`,
`session_inactive`, `record_not_found`, `lock_conflict` and `incomplete_upload`
(2 each), and 19 singletons.

Recommended follow-up (**V1-818**): key the Arabic map on `code`, not on the
English sentence, in `translateKnownApiError`. `code` already survives the
client's envelope handling (`{...payload, code: …}` at both the JSON and the
non-2xx branch), so this is a Next-side change only — no Laravel edit, no
contract change. Keep the existing exact-string entries as a second lookup so
the ~50 pages that still compare `response.error === "Forbidden."` keep
working. 26 codes is a small enough table to write by hand; the generic
`not_found` message needs a per-call-site override or a neutral wording like
«العنصر غير موجود.» because it covers records, tags, types, collections and
saved searches alike.

### A2 — P2 — Framework validation messages are English and are the cheapest to fix

Distinct from A1: 51 controllers call `$request->validate(...)`, and
`ValidationException` escapes to the central renderer in
`bootstrap/app.php` → `ApiError::renderException()`. That attaches
`$e->errors()` verbatim, so the UI receives Laravel's own English strings
("The title field is required."). `ApiError::genericMessageForStatus()` adds
more English defaults — "Unauthorized.", "Not found.", "Too many requests."

Unlike A1 these are *framework* strings, so they need no per-message table:
publishing `lang/ar/validation.php` and setting `APP_LOCALE=ar` localizes all
of them at once. `config/app.php:81` currently reads
`env('APP_LOCALE', 'en')` and `.env.example:21` pins `APP_LOCALE=en`.

Caveat worth resolving before flipping it: `ApiError`'s own literals and the
controller sentences are hardcoded PHP strings, not `__()` calls, so changing
the locale does **not** move them — A1 stays open either way. Also check
whether any PHPUnit test asserts on an English validation message before
switching the default.

### A3 — P3 — Notifications are already Arabic; only interpolated failure text leaks

`app/Services/Notification/NotificationService.php` builds all five
notification types in Arabic — «اكتمل الإدراج», «اكتمل النسخ الاحتياطي»,
«إشارة مشاركة», «اكتملت استعادة النسخة الاحتياطية», and the mention title.
There is no English notification body and no unlocalized fallback except
«خطأ غير معروف», which is itself Arabic. This half of V1-791 is clean.

One leak remains: `createBackupNotification()` and `createRestoreNotification()`
interpolate the caller's `$error` string into an otherwise Arabic sentence, so
a raw English exception message can surface inside «فشل النسخ الاحتياطي: …».
Low impact — the Arabic frame still carries the meaning — but the same code
mapping from A1 would fix it if the callers pass a code rather than a message.

### A4 — P3 — Icon direction is correct everywhere it is load-bearing

Swept every directional identifier in `archive-next` (chevrons, arrows, move,
skip, corner, panel, indent, log-in/out variants). Five call sites, four of
them already correct:

| Site | Verdict |
|---|---|
| `components/StorageBrowser.tsx:74` — `ChevronRight` on «المجلد السابق» | Correct — fixed in `d49580c4`; "back one level" points right in RTL. |
| `components/WorkspaceCommandBar.tsx:53` — `ChevronLeft` as breadcrumb separator | Correct — RTL breadcrumbs descend leftwards, so the separator points left. |
| `components/ui/DataTable.tsx:138` — `ArrowLeft`/`ArrowRight` | Not icons; these are `KeyboardEvent.key` names. `scrollBy({left: ±64})` maps each physical arrow key to the matching physical scroll direction, which stays right in an RTL container. |
| `app/projects/page.tsx:375` — literal `→` between timecodes | Correct — the span is explicitly `dir="ltr"`, so in→out reads left-to-right as intended. |
| `components/StorageBrowser.tsx:26` — `MoveRight` for the «نقل» action | **Only open item.** A right-pointing arrow reads as "backwards" in an RTL UI. Decorative next to a text label, so impact is cosmetic; the fix is the one-token swap to `MoveLeft`. |

`lib/icon-catalog.ts:41-42` also lists `ArrowRight`/`ArrowLeft`, but those are
user-pickable icons for taxonomy entries, not app affordances — the user picks
whichever direction they mean.

## Checks performed

- Static scan of `archive-laravel/app/Http/Controllers/Api/V1` for
  `'error' => '…'` literals and for a `'code' =>` key within ±4 lines: 63 with
  a code, 0 without.
- Distinct-code histogram over `archive-laravel/app`: 26 codes, 67 occurrences.
- Confirmed `archive-laravel` ships no application `lang/` directory (only
  vendor framework translations, English).
- Read `bootstrap/app.php`, `app/Support/ApiError.php`,
  `app/Services/Notification/NotificationService.php`,
  `lib/archive-api.ts:1331-1355`.
- Regex sweep for directional icon identifiers and literal arrow glyphs across
  `app/`, `components/`, `lib/`, excluding tests.

## Decision

No product string was changed. A1 and A2 are each a contained change but a
behavioral one across every page's error path, which belongs in its own task
with its own tests rather than inside an audit. A4's single finding is a
one-token swap and is left for whoever picks up V1-818 so the RTL change ships
with a test like the one `d49580c4` added.

## V1-823 (2026-07-28): backend half completed

A2's recommended follow-up is done. `lang/ar/validation.php` was added, scoped
to the validation rules actually used across `app/Http/Controllers/Api/V1` and
`app/Http/Requests` (confirmed by a repo-wide grep, not translated
speculatively): `required`, `string`, `array`, `integer`, `numeric`, `boolean`,
`email`, `url`, `file`, `image`, `date`, `date_format`, `after`, `different`,
`json`, `in`, `regex`, plus the sized variants of `max`/`min`/`size`/`gt`. Rules
not in the app's actual usage (`unique`, `exists`, `confirmed`, `uuid`, `alpha`,
...) are intentionally left untranslated -- `APP_FALLBACK_LOCALE` stays `en`,
so any of those degrade to English instead of a broken translation key.

`APP_LOCALE` default changed from `en` to `ar` in both `.env.example` and
`config/app.php`'s `env()` fallback. Checked first whether this was safe:
grepped `tests/` for assertions on Laravel's own framework validation text
(`'The ... field'`) and found none -- the two matches were both
controller-built strings (`SystemConnectionTestTest`, `SystemControlApiTest`),
not framework output, so no existing test pins the English wording.

A1 (the ~50 API error strings) remains addressed only on the Next.js side
(V1-818, `105619af`) -- this piece was specifically the framework validation
messages, which are a different code path (`ValidationException` -> the
central `ApiError::renderException` fallback) from the manually-built
`{ok:false}` envelopes A1 covers.

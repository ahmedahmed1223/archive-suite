# Public documentation style

[العربية](public-writing-style.ar.md) · [Documentation](README.md)

Use this guide for every public Archive Suite document. Public documentation
must describe supported product behavior, not internal delivery history.

## Audience and structure

- Start with the user outcome and name the intended audience.
- Put prerequisites before commands and verification after them.
- Keep one topic per page and link to the source of truth instead of copying it.
- Use exact commands, paths, environment variables, API routes, and product names.
- Do not publish task lists, acceptance evidence, agent notes, temporary blockers,
  rollout phases, or work that is still being evaluated.

## English and Arabic

Every living public page has an English file and an Arabic peer. English uses
the default `.md` name; Arabic uses `.ar.md`. The two pages must cover the same
capabilities, prerequisites, safety warnings, commands, and verification steps.
They do not need identical sentence or line counts.

Write Arabic as natural Modern Standard Arabic for a product user. Do not mirror
English word order. Keep exact technical identifiers in English when readers
must copy them or when no clearer established Arabic expression exists.

## Product terminology

- First mention: “direct-host operation (Native)”; later: “direct-host operation”.
- Arabic first mention: «التشغيل المباشر دون حاويات (Native)»؛ ثم «التشغيل المباشر».
- Use “password manager” / «مدير كلمات المرور» and “secret store” / «مخزن أسرار».
- Use “access token” / «رمز وصول» and “audit log” / «سجل تدقيق».
- Keep `Docker`, `Next.js`, `Laravel`, `OpenAPI`, commands, and code identifiers unchanged.

## Release language

State only capabilities that the repository and release metadata verify. Use a
version number only when `package.json`, the release manifest, installation
manifest, checksums, and release notes agree. Historical engineering phases do
not belong in living documentation.

## Review checklist

- Both language links work and point to reciprocal pages.
- Relative links and heading anchors resolve.
- Commands match root scripts and supported platform outputs.
- Destructive steps include a backup and recovery warning.
- No internal plan, unfinished task, placeholder, or obsolete phase is exposed.
- Arabic reads naturally aloud and uses consistent product vocabulary.

# Arabic README Summary Design

## Goal

Provide an Arabic-first repository overview while preserving English for all
copy-and-paste technical material.

## Content Rules

- Write headings, explanatory paragraphs, feature summaries, release status,
  and workflow guidance in Arabic.
- Preserve commands, file paths, package names, API paths, environment
  variable names, service names, image names, and code identifiers in English.
- Keep the README an overview. Link to the feature guide, deployment guide,
  RC support guide, release notes, and operational runbooks instead of copying
  their detailed content.
- Describe the RC state accurately: it is experimental and not a GA or
  deployable production artifact.

## Structure

1. Arabic product summary and canonical architecture.
2. RC status and documentation links.
3. Arabic feature summary.
4. English technical quick start and verification commands, introduced by
   Arabic instructions.
5. Arabic pointers to deployment, support, and contributor documentation.

## Validation

Verify all Markdown links resolve to tracked repository files, preserve the
toolchain version from `infra/platform/toolchain.v1.json`, and run
`git diff --check` before publishing.

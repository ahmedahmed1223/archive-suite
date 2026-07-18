# Unified Search Design

**Date:** 2026-07-18  
**Scope:** Expand the canonical Laravel + Next.js search experience, including time-coded transcript results, semantic search, autocomplete, saved-search sharing, and accessible responsive UI.

## Goals

- Let users find a record through metadata, semantic relevance, or a spoken passage in a time-coded transcript.
- Open a matching video directly at the matched timestamp when a reliable timestamp exists.
- Make advanced search discoverable without removing the existing query syntax for expert users.
- Keep saved searches private by default, with optional read-only sharing to the team.
- Preserve Laravel as the API and authorization source of truth.

## Non-goals

- No dedicated search microservice or secondary system of record.
- No semantic search requirement when embeddings are unavailable.
- No time jump for a transcript that has no reliable cue timing.
- No team-wide editing of another user's saved search.

## Search modes

`GET /search` accepts an explicit search mode:

- `keyword`: existing record metadata matching and filters.
- `semantic`: embedding-ranked matching when enabled; otherwise the response falls back to keyword mode with an explicit fallback indicator.
- `transcript`: time-coded VTT/SRT transcript cues only. Each match returns the owning record, a matching cue excerpt, and `timestampSeconds`.

The client keeps the selected mode, query, filters, and pagination in the URL. A transcript result opens `/archive/{id}?at={timestampSeconds}`. The record page passes the timestamp to the media player after metadata is ready, then moves focus to the player without autoplaying media.

## Autocomplete

The client requests a bounded suggestions endpoint after a debounced query change and cancels obsolete requests. Suggestions are limited to records the caller may read, matching titles, tags, types, and the caller's recent searches. The combobox supports keyboard navigation, Enter, Escape, and screen-reader labels.

## Advanced search

The current advanced query syntax remains supported. The UI adds a visual filter builder for common predicates while retaining a direct query field for expert use. Search-result cards disclose why a result matched: metadata, semantic relevance, or a time-coded transcript cue.

## Saved searches

Saved searches persist query, mode, filters, and view preference. They are private by default. Owners and administrators may share a saved search with the team as a read-only shared entry, revoke sharing, or update the original. Other users can run or copy a shared search but cannot mutate it.

## Authorization and resilience

Every search, suggestion, and saved-search operation is authorized by Laravel. Semantic unavailability never blocks keyword search. Transcript mode returns a clear empty state when no accessible time-coded cues match. The API does not expose transcript text or suggestion metadata for records a caller cannot read.

## Delivery and verification

Implementation is one coordinated feature set with four internally sequenced slices:

1. Time-coded transcript search and deep-linked playback.
2. Search mode UI, semantic fallback, advanced-filter builder, and result explanations.
3. Autocomplete and personal recent-search suggestions.
4. Private/shared saved-search management.

Each slice begins with failing Laravel and/or Next.js tests. API changes update the OpenAPI contract and TypeScript client in the same change. Final verification includes affected test suites, API contract verification, typecheck, Next build, and accessible responsive checks for the search experience.

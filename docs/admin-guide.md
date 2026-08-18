# Administration guide

[العربية](admin-guide.ar.md) · [Documentation](README.md)

This guide covers in-product administration: the capabilities, presets, task
escalation, and approval policies that an administrator manages from
**Settings**. It does not cover Docker or host operations — see
[Control Center](control-center.md) for that.

## Capabilities

Open **Settings → Administration** (visible to the `admin` role only) to
review and, where allowed, change organization-wide capabilities. Each row
shows its current status, default value, and whether an administrator can
change it from the interface or only from deployment configuration.

| Capability | What it affects | Default | Who can change it |
| --- | --- | --- | --- |
| System control | Host-level maintenance actions available to administrators | On | Admin, in Settings (also gated by deployment configuration) |
| Backups | Whether backup creation and restore are offered | On | Fixed by the release; not editable in Settings |
| Trash | Soft-delete and restore instead of permanent deletion | On | Fixed by the release; not editable in Settings |
| ODBC | The SQL Server/PostgreSQL/MySQL bridge described in [rights, sharing, and ODBC](odbc-laravel-bridge.md) | On | Admin, in Settings (also gated by deployment configuration) |
| Broadcast metadata | Broadcast-specific fields on records | On | Admin, in Settings (also gated by deployment configuration) |
| Semantic search | Meaning-based search described in [semantic search](semantic-search.md) | Off | Not editable in Settings; requires PostgreSQL, `pgvector`, and an embeddings provider |
| Media processing | Real media processing (thumbnails, transcoding, transcription, OCR) instead of the built-in placeholder | Off | Not editable in Settings; requires the media profile and worker tools |
| OCR | Text extraction from image and document pages | Off | Not editable in Settings; requires media processing plus the OCR service |
| MCP | Model Context Protocol access for connected AI tools | On | Fixed by the release; not editable in Settings |

A capability an administrator can toggle in Settings still depends on its
underlying deployment configuration: if that configuration disables the
capability, it shows as unavailable regardless of the in-app toggle. A
capability that requires configuration (semantic search, media processing,
OCR) is not editable from Settings at all — an operator enables it by
configuring the corresponding service and restarting.

## Presets and navigation

**Settings → Presets** applies a bundle of module visibility, home page, and
archive view choices to the current user's own account in one action —
Archivist, Reviewer, Media editor, and Simple. Applying a preset copies its
values into that user's profile; it does not change what other users see, and
editing a preset's definition in a later release never retroactively changes
a profile that already applied it.

**Settings → Navigation** lets each user reorder navigation sections and hide
optional modules for their own account. Two constraints apply regardless of
role: a small set of mandatory items (including Settings itself) can never be
hidden, and a module gated behind a disabled or unconfigured capability
cannot be shown even if a user tries to unhide it — the capability lock in
the table above always wins.

## Task escalation policy

**Settings → Administration** (admin only) configures when overdue project
tasks escalate. The default policy sends a non-mandatory "due soon" notice
60 minutes before a task's deadline, then repeats a mandatory overdue
escalation every 240 minutes while the task stays overdue. An administrator
can change the warning lead time, the repeat interval, or turn escalation off
entirely; the policy applies to every project task, not per user or per
department.

## Sensitive operations and dual approval

Bulk actions submitted from **Approval requests** (delete, add tag, set
workflow status, set rights holder) run immediately by default. An
administrator can mark any of these operation types as sensitive from
Settings; a sensitive operation then requires the configured number of
approvals (2 by default, up to 10) from users other than the person who
submitted it before it executes. The person who submitted the request can
never approve their own request. Approved requests still require a separate
**Execute** action, so an approval never runs the operation automatically.

## Vocabulary templates and relinking

**Types → Templates** offers four built-in starting sets — broadcast, raw
footage, oral testimony, and human rights — that each create a record type, a
metadata template, and a starter tag list in one step. Applying a template
never overwrites an existing type, template, or tag with the same name; it
reports what already existed and what it added.

When a vocabulary term is renamed or removed, use **Types → Relink** to
preview every record that still carries the old term before replacing or
clearing it on those records in one reviewed step, instead of leaving a
broken tag reference behind. This action requires the editor role or above.

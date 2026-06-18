# Archive Suite Public API

Archive Suite exposes a small read-only public API for external systems that need to list archive records without using the internal JWT/RPC API.

The machine-readable OpenAPI schema is checked in at [`public-api.openapi.json`](public-api.openapi.json) and is also served by the API server:

```http
GET /api/public/openapi.json
GET /api/v1/public/openapi.json
```

Use `/api/v1/*` paths for new integrations. The legacy `/api/*` aliases remain available for compatibility and include `Sunset`/`Link` headers.

## Authentication

Public API calls authenticate with an API key in the `X-API-Key` header:

```http
GET /api/v1/public/records?store=video_items&limit=50
X-API-Key: ak_12345678_example-secret
```

API keys are created in the app settings through the authenticated management routes. The plaintext key is shown once when it is created. The server stores only a SHA-256 hash, rejects inactive or expired keys, and requires the key to include the `read` scope for public record reads.

## Records Endpoint

```http
GET /api/v1/public/records
GET /api/public/records
```

Query parameters:

| Name | Default | Notes |
|---|---:|---|
| `store` | `video_items` | Must be in the server allowlist. By default: `video_items`, `media_items`, `document_items`, `audio_items`, `image_items`. Operators can override this with `PUBLIC_API_STORES`. |
| `limit` | `50` | Page size, clamped to `1` through `200`. |
| `cursor` | none | Pass the previous response's `nextCursor` to fetch the next page. |

Successful response:

```json
{
  "ok": true,
  "store": "video_items",
  "count": 125,
  "records": [
    {
      "id": "video-001",
      "title": "Interview archive",
      "documentType": "video",
      "tags": ["oral-history"]
    }
  ],
  "nextCursor": "video-001"
}
```

## Pagination

Records are sorted by `id` and fall back to `uid` when `id` is missing. The cursor is the last returned record id/uid. A final page returns `"nextCursor": null`.

Example:

```http
GET /api/v1/public/records?store=video_items&limit=100
X-API-Key: ak_...

GET /api/v1/public/records?store=video_items&limit=100&cursor=video-001
X-API-Key: ak_...
```

`count` is the total number of records in the requested store before pagination, not the number of records in the current page.

## Errors

All JSON errors use the same shape:

```json
{
  "ok": false,
  "error": "مفتاح API غير صالح أو منتهٍ."
}
```

Documented statuses:

| Status | Meaning |
|---:|---|
| `401` | Missing, invalid, expired, inactive, or revoked `X-API-Key`. |
| `403` | The key does not have `read` scope, or the requested `store` is not public-readable. |
| `429` | Rate limit exceeded. The public records endpoint has a per-key limit, defaulting to 120 requests per minute, and may also be subject to the server's general IP-based limiter. |
| `500` | Unexpected server failure. |

## Security Notes

The public records endpoint uses an allowlist instead of a denylist. Sensitive stores such as users, API keys, webhooks, notification preferences, push subscriptions, and config are not readable unless an operator explicitly adds a store to `PUBLIC_API_STORES`.

Keep API keys server-side in CMS connectors and scheduled jobs. Do not embed them in public browser code.

// @ts-nocheck
// Rights API client - thin fetch wrapper for /api/rights/* endpoints.
// All requests require a Bearer token (cloud backend only).
// Returns the server envelope: { ok, record?, records?, error? }

function buildHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

export async function fetchItemRights({ base = '', getToken, itemId, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const token = typeof getToken === 'function' ? getToken() : '';
  const response = await doFetch(
    stripTrailingSlash(base) + '/api/rights?itemId=' + encodeURIComponent(itemId),
    { headers: buildHeaders(token) }
  );
  return response.json();
}

export async function saveItemRights({ base = '', getToken, payload, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const token = typeof getToken === 'function' ? getToken() : '';
  const response = await doFetch(
    stripTrailingSlash(base) + '/api/rights',
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    }
  );
  return response.json();
}

export async function fetchExpiringRights({ base = '', getToken, days = 30, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const token = typeof getToken === 'function' ? getToken() : '';
  const response = await doFetch(
    stripTrailingSlash(base) + '/api/rights/expiring?days=' + encodeURIComponent(days),
    { headers: buildHeaders(token) }
  );
  return response.json();
}


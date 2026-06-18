export class ImportPreviewError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ImportPreviewError";
    this.status = status;
  }
}

function resolveFetch(fetchImpl) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ImportPreviewError("لا يوجد منفّذ fetch.");
  return doFetch;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new ImportPreviewError("استجابة معاينة الاستيراد غير صالحة.", { status: response.status });
  }
}

export async function previewImportSources({
  baseUrl = "",
  urls = [],
  token = "",
  fetchImpl
} = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const response = await resolveFetch(fetchImpl)(`${base}/api/import/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ urls })
  });
  const payload = await readJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new ImportPreviewError(payload?.error || "فشل جلب معاينة الاستيراد.", { status: response.status });
  }
  return payload?.result?.items || [];
}

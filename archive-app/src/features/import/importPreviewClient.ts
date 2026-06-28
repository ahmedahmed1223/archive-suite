export class ImportPreviewError extends Error {
  status: number;

  constructor(message: string, { status = 0 }: { status?: number } = {}) {
    super(message);
    this.name = "ImportPreviewError";
    this.status = status;
  }
}

interface PreviewResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type PreviewFetch = (url: string, init: {
  method: "POST";
  headers: Record<string, string>;
  body: string;
}) => Promise<PreviewResponse>;

interface PreviewImportOptions {
  baseUrl?: string;
  urls?: string[];
  token?: string;
  fetchImpl?: PreviewFetch;
}

interface PreviewPayload {
  ok?: boolean;
  error?: string;
  result?: {
    items?: unknown[];
  };
}

function resolveFetch(fetchImpl?: PreviewFetch): PreviewFetch {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) as PreviewFetch : null);
  if (!doFetch) throw new ImportPreviewError("لا يوجد منفّذ fetch.");
  return doFetch;
}

async function readJson(response: PreviewResponse): Promise<PreviewPayload> {
  try {
    return await response.json() as PreviewPayload;
  } catch {
    throw new ImportPreviewError("استجابة معاينة الاستيراد غير صالحة.", { status: response.status });
  }
}

export async function previewImportSources({
  baseUrl = "",
  urls = [],
  token = "",
  fetchImpl
}: PreviewImportOptions = {}): Promise<unknown[]> {
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

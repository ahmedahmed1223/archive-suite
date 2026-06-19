// G6 — scoped sharing client (SPA side).
//
// Mints public share links against archive-server (POST /api/share) and reads
// them back (GET /api/share/:token). The token is opaque; the public viewer is
// reached by opening the SPA with ?share=<token>, which the boot path detects.
// All network goes through an injectable fetch so the logic is unit-testable.

export class ShareClientError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ShareClientError";
    this.status = status;
  }
}

/** Whether sharing is possible: needs a cloud backend and a token. */
export function canShare({ backend, token } = {}) {
  return backend !== "local" && Boolean(token);
}

/** Read a share token from a Location-like object (?share=… or #share=…). */
export function detectShareToken(loc = (typeof location !== "undefined" ? location : null)) {
  if (!loc) return "";
  try {
    const fromSearch = new URLSearchParams(loc.search || "").get("share");
    if (fromSearch) return fromSearch;
    const hash = String(loc.hash || "").replace(/^#/, "");
    const fromHash = new URLSearchParams(hash.includes("=") ? hash : "").get("share");
    return fromHash || "";
  } catch {
    return "";
  }
}

/** Build the public share URL for a token at the given origin. */
export function buildShareUrl(token, { origin = (typeof location !== "undefined" ? location.origin : "") } = {}) {
  return `${String(origin || "").replace(/\/+$/, "")}/?share=${encodeURIComponent(token)}`;
}

/**
 * Mint a share link for a scope.
 * @returns {Promise<{ token: string, url: string, jti?: string }>}
 */
export async function mintShareLink({ scope, title = "", expiresInDays, password = "", baseUrl = "", getToken, fetchImpl, origin } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ShareClientError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  if (!token) throw new ShareClientError("المشاركة تتطلّب تسجيل الدخول إلى خادم سحابي.");

  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    response = await doFetch(`${base}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        scope,
        title: String(title || "").trim(),
        ...(Number(expiresInDays) > 0 ? { expiresInDays: Number(expiresInDays) } : {}),
        ...(String(password || "").trim() ? { password: String(password || "").trim() } : {})
      })
    });
  } catch (networkError) {
    throw new ShareClientError(`تعذّر الاتصال بخادم المشاركة: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new ShareClientError("استجابة غير صالحة من خادم المشاركة.", { status: response.status }); }
  if (!response.ok || !payload?.ok || !payload?.result?.token) {
    throw new ShareClientError(payload?.error || "فشل إنشاء رابط المشاركة.", { status: response.status });
  }
  const shareToken = payload.result.token;
  return {
    token: shareToken,
    url: buildShareUrl(shareToken, { origin }),
    title: payload.result.title || "",
    expiresAt: payload.result.expiresAt || "",
    jti: payload.result.jti || "",
    passwordProtected: Boolean(payload.result.passwordProtected)
  };
}

/** Revoke a previously minted share link by token jti. */
export async function revokeShareLink({ jti, baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ShareClientError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  if (!token) throw new ShareClientError("إلغاء الرابط يتطلّب تسجيل الدخول إلى خادم سحابي.");
  const cleanJti = String(jti || "").trim();
  if (!cleanJti) throw new ShareClientError("معرّف الرابط غير متاح للإلغاء.");

  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    response = await doFetch(`${base}/api/share/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jti: cleanJti })
    });
  } catch (networkError) {
    throw new ShareClientError(`تعذّر الاتصال بخادم المشاركة: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new ShareClientError("استجابة غير صالحة من خادم المشاركة.", { status: response.status }); }
  if (!response.ok || !payload?.ok) {
    throw new ShareClientError(payload?.error || "فشل إلغاء رابط المشاركة.", { status: response.status });
  }
  return payload.result || { revoked: true, jti: cleanJti };
}

/** Send an email invitation for a scoped share link. */
export async function inviteShareByEmail({
  email,
  message = "",
  scope,
  title = "",
  expiresInDays,
  password = "",
  baseUrl = "",
  getToken,
  fetchImpl,
  origin
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ShareClientError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  if (!token) throw new ShareClientError("إرسال الدعوة يتطلّب تسجيل الدخول إلى خادم سحابي.");
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) throw new ShareClientError("أدخل بريد المستلم.");

  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    response = await doFetch(`${base}/api/share/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: cleanEmail,
        message: String(message || "").trim(),
        scope,
        title: String(title || "").trim(),
        ...(Number(expiresInDays) > 0 ? { expiresInDays: Number(expiresInDays) } : {}),
        ...(String(password || "").trim() ? { password: String(password || "").trim() } : {})
      })
    });
  } catch (networkError) {
    throw new ShareClientError(`تعذّر الاتصال بخادم المشاركة: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new ShareClientError("استجابة غير صالحة من خادم المشاركة.", { status: response.status }); }
  if (!response.ok || !payload?.ok || !payload?.result?.token) {
    throw new ShareClientError(payload?.error || "فشل إرسال دعوة المشاركة.", { status: response.status });
  }
  const shareToken = payload.result.token;
  return {
    token: shareToken,
    url: buildShareUrl(shareToken, { origin }),
    invitation: payload.result.invitation || null,
    emailStatus: payload.result.emailStatus || null,
    jti: payload.result.invitation?.shareJti || ""
  };
}

/** Fetch the read-only scoped snapshot behind a share token (public, no auth). */
export async function fetchSharedView({ token, baseUrl = "", fetchImpl, password = "" } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ShareClientError("لا يوجد منفّذ fetch.");
  if (!token) throw new ShareClientError("رابط المشاركة غير صالح.", { status: 404 });
  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    const trimmedPassword = String(password || "").trim();
    response = await doFetch(`${base}/api/share/${encodeURIComponent(token)}`, trimmedPassword ? {
      headers: { "x-share-password": trimmedPassword }
    } : undefined);
  } catch (networkError) {
    throw new ShareClientError(`تعذّر الاتصال بالخادم: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new ShareClientError("استجابة غير صالحة.", { status: response.status }); }
  if (!response.ok || !payload?.ok) {
    throw new ShareClientError(payload?.error || "رابط المشاركة غير موجود أو منتهٍ.", { status: response.status });
  }
  return payload.result;
}

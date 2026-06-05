import { signJwt, verifyJwt } from "../auth/jwt.js";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DEFAULT_SCOPES = [
  "files.content.read",
  "files.content.write",
  "sharing.read",
  "account_info.read"
];

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export function buildDropboxOAuthUrl({
  appKey,
  redirectUri,
  state,
  scopes = DEFAULT_SCOPES,
  forceReapprove = false
} = {}) {
  if (!appKey) throw new Error("DROPBOX_APP_KEY is required to start Dropbox OAuth.");
  if (!redirectUri) throw new Error("Dropbox OAuth redirectUri is required.");
  if (!state) throw new Error("Dropbox OAuth state is required.");
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  if (forceReapprove) url.searchParams.set("force_reapprove", "true");
  if (Array.isArray(scopes) && scopes.length) url.searchParams.set("scope", scopes.join(" "));
  return url.toString();
}

export function createDropboxOAuthState({
  secret,
  rootPath = "",
  selectUser = "",
  selectAdmin = "",
  redirectUri = "",
  returnTo = ""
} = {}) {
  if (!secret) throw new Error("Dropbox OAuth state needs a signing secret.");
  return signJwt({
    kind: "dropbox-oauth",
    rootPath: cleanText(rootPath, 300),
    selectUser: cleanText(selectUser, 200),
    selectAdmin: cleanText(selectAdmin, 200),
    redirectUri: cleanText(redirectUri, 1000),
    returnTo: cleanText(returnTo, 1000)
  }, secret, { expiresInSec: 10 * 60 });
}

export function readDropboxOAuthState(token, secret) {
  const fail = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
  };
  let payload;
  try {
    payload = verifyJwt(token, secret);
  } catch (error) {
    throw fail(`Invalid Dropbox OAuth state: ${error?.message || "bad state"}`);
  }
  if (!payload || payload.kind !== "dropbox-oauth") throw fail("Invalid Dropbox OAuth state.");
  return {
    rootPath: cleanText(payload.rootPath, 300),
    selectUser: cleanText(payload.selectUser, 200),
    selectAdmin: cleanText(payload.selectAdmin, 200),
    redirectUri: cleanText(payload.redirectUri, 1000),
    returnTo: cleanText(payload.returnTo, 1000)
  };
}

export async function exchangeDropboxOAuthCode({
  code,
  appKey,
  appSecret,
  redirectUri,
  fetchImpl
} = {}) {
  if (!code) throw new Error("Dropbox OAuth callback did not include a code.");
  if (!appKey || !appSecret) throw new Error("DROPBOX_APP_KEY and DROPBOX_APP_SECRET are required to finish Dropbox OAuth.");
  if (!redirectUri) throw new Error("Dropbox OAuth redirectUri is required.");
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("Dropbox OAuth needs a fetch implementation.");

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  }).toString();
  const res = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok || !json?.access_token) {
    const err = new Error(json?.error_description || json?.error || `Dropbox OAuth exchange failed (${res.status}).`);
    err.statusCode = 502;
    throw err;
  }
  const expiresIn = Math.max(60, Number(json.expires_in || 14_400));
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    accountId: json.account_id || "",
    scope: json.scope || ""
  };
}

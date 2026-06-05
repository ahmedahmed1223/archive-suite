import assert from "node:assert/strict";

import {
  buildDropboxOAuthUrl,
  exchangeDropboxOAuthCode,
  createDropboxOAuthState,
  readDropboxOAuthState
} from "../src/dropbox/oauth.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

function res({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok, status,
    text: async () => JSON.stringify(body)
  };
}

run("buildDropboxOAuthUrl creates an offline-code authorization URL", () => {
  const url = buildDropboxOAuthUrl({
    appKey: "app-key",
    redirectUri: "https://example.com/api/dropbox/oauth/callback",
    state: "STATE",
    scopes: ["files.content.read", "files.content.write"]
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://www.dropbox.com/oauth2/authorize");
  assert.equal(parsed.searchParams.get("client_id"), "app-key");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("token_access_type"), "offline");
  assert.equal(parsed.searchParams.get("state"), "STATE");
  assert.equal(parsed.searchParams.get("redirect_uri"), "https://example.com/api/dropbox/oauth/callback");
  assert.match(parsed.searchParams.get("scope"), /files\.content\.read/);
});

run("OAuth state is signed and round-trips the selected Dropbox account", () => {
  const secret = "oauth-secret";
  const token = createDropboxOAuthState({
    secret,
    rootPath: "/archive",
    selectUser: "dbid:user1",
    selectAdmin: "dbid:admin1",
    redirectUri: "https://example.com/api/dropbox/oauth/callback",
    returnTo: "https://example.com/settings"
  });
  assert.deepEqual(readDropboxOAuthState(token, secret), {
    rootPath: "/archive",
    selectUser: "dbid:user1",
    selectAdmin: "dbid:admin1",
    redirectUri: "https://example.com/api/dropbox/oauth/callback",
    returnTo: "https://example.com/settings"
  });
  assert.throws(() => readDropboxOAuthState(`${token}x`, secret), /Invalid/);
});

run("exchangeDropboxOAuthCode posts a code grant with Basic auth", async () => {
  const fetchImpl = async (url, opts = {}) => {
    assert.equal(url, "https://api.dropboxapi.com/oauth2/token");
    assert.equal(opts.method, "POST");
    assert.equal(opts.headers.Authorization, `Basic ${Buffer.from("app:secret").toString("base64")}`);
    assert.match(opts.body, /grant_type=authorization_code/);
    assert.match(opts.body, /code=CODE/);
    assert.match(opts.body, /redirect_uri=https%3A%2F%2Fexample.com%2Fcb/);
    return res({ body: { access_token: "access", refresh_token: "refresh", expires_in: 14400 } });
  };
  const out = await exchangeDropboxOAuthCode({ code: "CODE", appKey: "app", appSecret: "secret", redirectUri: "https://example.com/cb", fetchImpl });
  assert.equal(out.accessToken, "access");
  assert.equal(out.refreshToken, "refresh");
  assert.ok(out.expiresAt);
});

run("HTTP: admin starts OAuth; public callback stores Dropbox refresh token", async () => {
  const SECRET = "dropbox-oauth";
  let saved = null;
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    rateLimit: null,
    resolveConfig: () => ({
      fileStore: "dropbox",
      fileStoreSource: "file",
      dropboxAppKey: "app",
      dropboxAppSecret: "secret",
      dropboxRootPath: "/existing"
    }),
    loadConfigFile: () => ({ fileStore: { kind: "dropbox", dropbox: { appKey: "app", appSecret: "secret", rootPath: "/existing" } } }),
    saveConfig: (cfg) => { saved = cfg; return true; },
    dropboxOAuthFetch: async (url, opts = {}) => {
      assert.equal(url, "https://api.dropboxapi.com/oauth2/token");
      assert.match(opts.body, /code=CODE/);
      return res({ body: { access_token: "new-access", refresh_token: "new-refresh", expires_in: 14400 } });
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = signJwt({ sub: "u1", role: "admin" }, SECRET);
  try {
    const start = await fetch(`${base}/api/admin/dropbox/oauth/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` },
      body: JSON.stringify({ rootPath: "/linked", selectUser: "dbid:user1", returnTo: `${base}/settings` })
    });
    assert.equal(start.status, 200);
    const startBody = (await start.json()).result;
    assert.match(startBody.authUrl, /^https:\/\/www\.dropbox\.com\/oauth2\/authorize/);
    const state = new URL(startBody.authUrl).searchParams.get("state");
    assert.ok(state);

    const callback = await fetch(`${base}/api/dropbox/oauth/callback?code=CODE&state=${encodeURIComponent(state)}`, { redirect: "manual" });
    assert.equal(callback.status, 302);
    assert.equal(saved.fileStore.kind, "dropbox");
    assert.equal(saved.fileStore.dropbox.refreshToken, "new-refresh");
    assert.equal(saved.fileStore.dropbox.accessToken, "new-access");
    assert.equal(saved.fileStore.dropbox.rootPath, "/linked");
    assert.equal(saved.fileStore.dropbox.selectUser, "dbid:user1");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll Dropbox OAuth tests passed.");
});

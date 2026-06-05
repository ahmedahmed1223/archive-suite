import assert from "node:assert/strict";

import { createDropboxFileStore, dropboxPath, DropboxFileError } from "../src/adapters/files-dropbox/index.js";
import { buildFileStore } from "../src/bootstrap/registerCloudProviders.js";

// Dropbox FileStore tests — pure path mapping + the adapter driven by a fake
// fetch (no network, no real Dropbox). Verifies request shapes per endpoint and
// response handling (missing files, idempotent delete, list pagination).

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

// A scriptable fake fetch: routes by URL substring, records calls.
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [needle, handler] of routes) {
      if (url.includes(needle)) return handler(url, opts);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  impl.calls = calls;
  return impl;
}
function res({ ok = true, status = 200, body = "", bytes } = {}) {
  return {
    ok, status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    arrayBuffer: async () => (bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : new ArrayBuffer(0))
  };
}

run("dropboxPath maps keys under root + blocks traversal", () => {
  assert.equal(dropboxPath("", "thumbs/a.jpg"), "/thumbs/a.jpg");
  assert.equal(dropboxPath("/archive", "a.jpg"), "/archive/a.jpg");
  assert.equal(dropboxPath("/archive/", "/a.jpg"), "/archive/a.jpg");        // trims slashes
  assert.throws(() => dropboxPath("/archive", "../escape"), (e) => e instanceof DropboxFileError);
  assert.throws(() => dropboxPath("/archive", ""), /Invalid file key/);
});

run("buildFileStore selects dropbox via FILE_STORE + token", () => {
  const store = buildFileStore({ fileStore: "dropbox", dropboxAccessToken: "tok", dropboxRootPath: "/archive" });
  assert.equal(typeof store.putBlob, "function");
  assert.equal(typeof store.list, "function");
  // disk fallback when not dropbox
  const disk = buildFileStore({ fileStore: "disk", fileStoreDir: ".tmp-files" });
  assert.equal(typeof disk.putBlob, "function");
});

run("buildFileStore selects Dropbox from resolved server config", () => {
  const store = buildFileStore({
    resolveConfig: () => ({
      fileStore: "dropbox",
      dropboxAccessToken: "tok-from-file",
      dropboxRootPath: "/saved-root",
      dropboxSelectUser: "dbid:user1"
    })
  });
  assert.equal(store.describe().kind, "dropbox");
  assert.equal(store.describe().rootPath, "/saved-root");
  assert.equal(store.describe().selectUser, "dbid:user1");
});

run("putBlob uploads to content endpoint with Dropbox-API-Arg path", async () => {
  const fetchImpl = fakeFetch([["/files/upload", () => res({ ok: true, body: { name: "a.jpg" } })]]);
  const store = createDropboxFileStore({ accessToken: "tok", rootPath: "/archive", selectUser: "dbid:user1", fetchImpl });
  const out = await store.putBlob("thumbs/a.jpg", Buffer.from("DATA"));
  const call = fetchImpl.calls[0];
  assert.match(call.url, /content\.dropboxapi\.com\/2\/files\/upload/);
  assert.equal(call.opts.headers.Authorization, "Bearer tok");
  assert.equal(call.opts.headers["Dropbox-API-Select-User"], "dbid:user1");
  assert.deepEqual(JSON.parse(call.opts.headers["Dropbox-API-Arg"]).path, "/archive/thumbs/a.jpg");
  assert.equal(out.key, "thumbs/a.jpg");
  assert.match(out.url, /\/api\/files\//);
});

run("refresh-token mode obtains an access token before Dropbox calls", async () => {
  const fetchImpl = fakeFetch([
    ["/oauth2/token", (_url, opts) => {
      assert.match(opts.body, /grant_type=refresh_token/);
      assert.match(opts.body, /refresh_token=rt/);
      assert.equal(opts.headers.Authorization, `Basic ${Buffer.from("app:secret").toString("base64")}`);
      return res({ ok: true, body: { access_token: "fresh-token" } });
    }],
    ["/files/list_folder", (_url, opts) => {
      assert.equal(opts.headers.Authorization, "Bearer fresh-token");
      return res({ ok: true, body: { entries: [], has_more: false } });
    }]
  ]);
  const store = createDropboxFileStore({ refreshToken: "rt", appKey: "app", appSecret: "secret", fetchImpl });
  assert.equal(store.describe().auth, "oauth-refresh-token");
  assert.deepEqual(await store.list(), []);
});

run("getBlob returns Buffer on 200, null on not_found 409", async () => {
  const okFetch = fakeFetch([["/files/download", () => res({ ok: true, bytes: Buffer.from("HELLO") })]]);
  const store = createDropboxFileStore({ accessToken: "t", rootPath: "", fetchImpl: okFetch });
  const buf = await store.getBlob("a.bin");
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString(), "HELLO");

  const missFetch = fakeFetch([["/files/download", () => res({ ok: false, status: 409, body: { error_summary: "path/not_found/." } })]]);
  const store2 = createDropboxFileStore({ accessToken: "t", fetchImpl: missFetch });
  assert.equal(await store2.getBlob("missing.bin"), null);
});

run("getUrl returns temporary link, null when missing", async () => {
  const linkFetch = fakeFetch([["/files/get_temporary_link", () => res({ ok: true, body: { link: "https://dl.dropboxusercontent.com/x" } })]]);
  const store = createDropboxFileStore({ accessToken: "t", fetchImpl: linkFetch });
  assert.equal(await store.getUrl("a.jpg"), "https://dl.dropboxusercontent.com/x");

  const missFetch = fakeFetch([["/files/get_temporary_link", () => res({ ok: false, status: 409, body: { error_summary: "path/not_found/." } })]]);
  const store2 = createDropboxFileStore({ accessToken: "t", fetchImpl: missFetch });
  assert.equal(await store2.getUrl("missing"), null);
});

run("remove is idempotent (ok or already-gone)", async () => {
  const okFetch = fakeFetch([["/files/delete_v2", () => res({ ok: true, body: { metadata: {} } })]]);
  await createDropboxFileStore({ accessToken: "t", fetchImpl: okFetch }).remove("a.jpg"); // no throw
  const goneFetch = fakeFetch([["/files/delete_v2", () => res({ ok: false, status: 409, body: { error_summary: "path_lookup/not_found/." } })]]);
  await createDropboxFileStore({ accessToken: "t", fetchImpl: goneFetch }).remove("a.jpg"); // no throw
});

run("list follows the cursor + filters by prefix, strips root", async () => {
  let page = 0;
  const fetchImpl = fakeFetch([
    ["/files/list_folder/continue", () => res({ ok: true, body: { entries: [{ ".tag": "file", path_display: "/archive/thumbs/c.jpg" }], has_more: false } })],
    ["/files/list_folder", () => {
      page += 1;
      return res({ ok: true, body: {
        entries: [
          { ".tag": "file", path_display: "/archive/thumbs/a.jpg" },
          { ".tag": "folder", path_display: "/archive/thumbs" },
          { ".tag": "file", path_display: "/archive/other/b.jpg" }
        ],
        has_more: true, cursor: "CURSOR1"
      } });
    }]
  ]);
  const store = createDropboxFileStore({ accessToken: "t", rootPath: "/archive", fetchImpl });
  const keys = await store.list("thumbs/");
  assert.deepEqual(keys.sort(), ["thumbs/a.jpg", "thumbs/c.jpg"]); // folder + other/ excluded
  // empty/never-created folder → []
  const emptyFetch = fakeFetch([["/files/list_folder", () => res({ ok: false, status: 409, body: { error_summary: "path/not_found/." } })]]);
  assert.deepEqual(await createDropboxFileStore({ accessToken: "t", rootPath: "/archive", fetchImpl: emptyFetch }).list(), []);
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll Dropbox file store tests passed.");
});

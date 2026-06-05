import assert from "node:assert/strict";

import { createAzureBlobFileStore, azureBlobName, stripAzurePrefix } from "../src/adapters/files-azure/index.js";
import { buildFileStore } from "../src/bootstrap/registerCloudProviders.js";

// Azure Blob FileStore tests — pure blob-name mapping + the adapter driven by a
// fake ContainerClient (records calls, returns canned data). No network, no
// Azure account.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

// Fake ContainerClient: per-blob clients record their inputs; listBlobsFlat is
// an async generator like the real SDK.
function fakeContainer({ blobs = [], onUpload, onDelete, downloadBuffer, sasUrl, throwNotFound } = {}) {
  const calls = { upload: [], deleted: [] };
  return {
    calls,
    getBlockBlobClient(name) {
      return {
        url: `https://acct.blob.core.windows.net/c/${name}`,
        async uploadData(bytes, opts) { calls.upload.push({ name, size: bytes.length, opts }); onUpload?.(name); },
        async downloadToBuffer() {
          if (throwNotFound) { const e = new Error("not found"); e.statusCode = 404; throw e; }
          return downloadBuffer ?? Buffer.from(`DATA:${name}`);
        },
        async deleteIfExists() { calls.deleted.push(name); onDelete?.(name); return { succeeded: true }; },
        async generateSasUrl() { if (sasUrl === null) throw new Error("no creds"); return sasUrl || `${this.url}?sig=fake`; }
      };
    },
    async *listBlobsFlat(opts = {}) {
      const prefix = opts?.prefix || "";
      for (const name of blobs) {
        if (!prefix || name.startsWith(prefix)) yield { name };
      }
    }
  };
}

run("azureBlobName joins prefix + blocks traversal; stripAzurePrefix reverses", () => {
  assert.equal(azureBlobName("media", "a.jpg"), "media/a.jpg");
  assert.equal(azureBlobName("", "x/y.png"), "x/y.png");
  assert.equal(azureBlobName("/media/", "/a.jpg"), "media/a.jpg");
  assert.throws(() => azureBlobName("media", "../escape"), /Invalid file key/);
  assert.equal(stripAzurePrefix("media", "media/a.jpg"), "a.jpg");
});

run("buildFileStore selects azure via FILE_STORE (Azurite dev connection string)", () => {
  const prev = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const prevC = process.env.AZURE_STORAGE_CONTAINER;
  process.env.AZURE_STORAGE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;EndpointSuffix=core.windows.net";
  process.env.AZURE_STORAGE_CONTAINER = "media";
  try {
    const store = buildFileStore({ fileStore: "azure" });
    assert.equal(typeof store.putBlob, "function");
    assert.equal(typeof store.list, "function");
  } finally {
    if (prev === undefined) delete process.env.AZURE_STORAGE_CONNECTION_STRING; else process.env.AZURE_STORAGE_CONNECTION_STRING = prev;
    if (prevC === undefined) delete process.env.AZURE_STORAGE_CONTAINER; else process.env.AZURE_STORAGE_CONTAINER = prevC;
  }
});

run("putBlob uploads to prefixed blob with content type", async () => {
  const cc = fakeContainer();
  const store = createAzureBlobFileStore({ containerClient: cc, prefix: "media" });
  const out = await store.putBlob("thumbs/a.jpg", Buffer.from("DATA"), { contentType: "image/jpeg" });
  assert.equal(cc.calls.upload[0].name, "media/thumbs/a.jpg");
  assert.equal(cc.calls.upload[0].opts.blobHTTPHeaders.blobContentType, "image/jpeg");
  assert.equal(out.key, "thumbs/a.jpg");
  assert.match(out.url, /\/api\/files\//);
});

run("getBlob returns Buffer; null on 404", async () => {
  const ok = createAzureBlobFileStore({ containerClient: fakeContainer({ downloadBuffer: Buffer.from("HELLO") }) });
  assert.equal((await ok.getBlob("a.bin")).toString(), "HELLO");
  const miss = createAzureBlobFileStore({ containerClient: fakeContainer({ throwNotFound: true }) });
  assert.equal(await miss.getBlob("missing"), null);
});

run("getUrl returns SAS url, falls back to blob url without creds", async () => {
  const withSas = createAzureBlobFileStore({ containerClient: fakeContainer({ sasUrl: "https://acct/c/x?sig=ok" }), prefix: "p" });
  assert.equal(await withSas.getUrl("x"), "https://acct/c/x?sig=ok");
  const noCreds = createAzureBlobFileStore({ containerClient: fakeContainer({ sasUrl: null }), prefix: "p" });
  assert.match(await noCreds.getUrl("x"), /\/p\/x$/); // fallback to blob .url
});

run("remove deletes (idempotent) + list strips prefix and filters", async () => {
  const cc = fakeContainer({ blobs: ["media/thumbs/a.jpg", "media/thumbs/b.jpg", "media/other/c.jpg"] });
  const store = createAzureBlobFileStore({ containerClient: cc, prefix: "media" });
  await store.remove("thumbs/a.jpg");
  assert.deepEqual(cc.calls.deleted, ["media/thumbs/a.jpg"]);
  const keys = await store.list("thumbs");
  assert.deepEqual(keys.sort(), ["thumbs/a.jpg", "thumbs/b.jpg"]);
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll Azure Blob file store tests passed.");
});

import assert from "node:assert/strict";

import { createS3FileStore, s3Key, stripPrefix } from "../src/adapters/files-s3/index.js";
import { buildFileStore } from "../src/bootstrap/registerCloudProviders.js";

// S3-compatible FileStore tests — pure key mapping + the adapter driven by a
// fake S3 client (records the real Command objects, returns canned output). No
// network, no credentials. Covers Amazon S3 and every S3-compatible provider.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

// Fake S3 client: routes by command class name, records inputs.
function fakeClient(handlers) {
  const sent = [];
  return {
    sent,
    async send(command) {
      const name = command.constructor.name;
      sent.push({ name, input: command.input });
      const handler = handlers[name];
      if (!handler) throw new Error(`unexpected command: ${name}`);
      return handler(command.input);
    }
  };
}

run("s3Key joins prefix + blocks traversal; stripPrefix reverses it", () => {
  assert.equal(s3Key("archive", "thumbs/a.jpg"), "archive/thumbs/a.jpg");
  assert.equal(s3Key("", "a.jpg"), "a.jpg");
  assert.equal(s3Key("/archive/", "/a.jpg"), "archive/a.jpg");
  assert.throws(() => s3Key("archive", "../escape"), /Invalid file key/);
  assert.equal(stripPrefix("archive", "archive/thumbs/a.jpg"), "thumbs/a.jpg");
  assert.equal(stripPrefix("", "thumbs/a.jpg"), "thumbs/a.jpg");
});

run("buildFileStore selects s3 via FILE_STORE", () => {
  const prev = process.env.S3_BUCKET;
  process.env.S3_BUCKET = "bkt";
  try {
    const store = buildFileStore({ fileStore: "s3" });
    assert.equal(typeof store.putBlob, "function");
    assert.equal(typeof store.list, "function");
  } finally {
    if (prev === undefined) delete process.env.S3_BUCKET; else process.env.S3_BUCKET = prev;
  }
});

run("putBlob sends PutObjectCommand with prefixed key + content type", async () => {
  const client = fakeClient({ PutObjectCommand: () => ({}) });
  const store = createS3FileStore({ client, bucket: "media", prefix: "archive" });
  const out = await store.putBlob("thumbs/a.jpg", Buffer.from("DATA"), { contentType: "image/jpeg" });
  assert.equal(client.sent[0].name, "PutObjectCommand");
  assert.equal(client.sent[0].input.Bucket, "media");
  assert.equal(client.sent[0].input.Key, "archive/thumbs/a.jpg");
  assert.equal(client.sent[0].input.ContentType, "image/jpeg");
  assert.equal(out.key, "thumbs/a.jpg");
  assert.match(out.url, /\/api\/files\//);
});

run("getBlob returns Buffer; null on NoSuchKey", async () => {
  const okClient = fakeClient({ GetObjectCommand: () => ({ Body: { transformToByteArray: async () => new TextEncoder().encode("HELLO") } }) });
  const buf = await createS3FileStore({ client: okClient, bucket: "m" }).getBlob("a.bin");
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString(), "HELLO");

  const missClient = { async send() { const e = new Error("missing"); e.name = "NoSuchKey"; throw e; } };
  assert.equal(await createS3FileStore({ client: missClient, bucket: "m" }).getBlob("x"), null);

  const miss404 = { async send() { const e = new Error("nf"); e.$metadata = { httpStatusCode: 404 }; throw e; } };
  assert.equal(await createS3FileStore({ client: miss404, bucket: "m" }).getBlob("x"), null);
});

run("getUrl returns a presigned URL (injected presigner)", async () => {
  const client = fakeClient({});
  const store = createS3FileStore({ client, bucket: "m", prefix: "p", presign: async (_c, cmd, opts) => `https://signed/${cmd.input.Key}?e=${opts.expiresIn}` });
  assert.equal(await store.getUrl("a.jpg"), "https://signed/p/a.jpg?e=3600");
});

run("remove sends DeleteObjectCommand (idempotent)", async () => {
  const client = fakeClient({ DeleteObjectCommand: () => ({}) });
  await createS3FileStore({ client, bucket: "m", prefix: "p" }).remove("a.jpg");
  assert.equal(client.sent[0].name, "DeleteObjectCommand");
  assert.equal(client.sent[0].input.Key, "p/a.jpg");
});

run("list paginates via ContinuationToken + strips prefix", async () => {
  let page = 0;
  const client = fakeClient({
    ListObjectsV2Command: (input) => {
      page += 1;
      if (page === 1) {
        assert.equal(input.Prefix, "archive/thumbs"); // base + user prefix
        return { Contents: [{ Key: "archive/thumbs/a.jpg" }], IsTruncated: true, NextContinuationToken: "TOK" };
      }
      assert.equal(input.ContinuationToken, "TOK");
      return { Contents: [{ Key: "archive/thumbs/b.jpg" }], IsTruncated: false };
    }
  });
  const keys = await createS3FileStore({ client, bucket: "m", prefix: "archive" }).list("thumbs");
  assert.deepEqual(keys, ["thumbs/a.jpg", "thumbs/b.jpg"]);
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll S3 file store tests passed.");
});

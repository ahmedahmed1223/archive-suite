import assert from "node:assert/strict";

import { createGoogleDriveFileStore, driveFileName, stripDrivePrefix } from "../src/adapters/files-gdrive/index.js";
import { buildFileStore } from "../src/bootstrap/registerCloudProviders.js";

// Google Drive FileStore tests — pure name mapping + the adapter driven by a
// fake drive v3 client (records files.* calls, returns canned data). No network,
// no Google credentials.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

// Fake drive client: an in-memory folder of { name -> id }. files.list answers
// name='...' lookups and full-folder listings; create/update/delete mutate it.
function fakeDrive(initial = {}) {
  const byName = new Map(Object.entries(initial)); // name -> id
  const calls = { create: [], update: [], delete: [], get: [] };
  let nextId = 100;
  return {
    calls,
    snapshot: () => [...byName.keys()],
    files: {
      async list({ q = "", pageToken } = {}) {
        const nameMatch = /name='((?:[^'\\]|\\.)*)'/.exec(q);
        if (nameMatch) {
          const wanted = nameMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
          const id = byName.get(wanted);
          return { data: { files: id ? [{ id, name: wanted }] : [] } };
        }
        // full-folder listing (single page)
        if (pageToken) return { data: { files: [] } };
        return { data: { files: [...byName.keys()].map((name) => ({ name })), nextPageToken: undefined } };
      },
      async create({ requestBody, media }) { const id = `id${nextId++}`; byName.set(requestBody.name, id); calls.create.push({ name: requestBody.name, parents: requestBody.parents, mimeType: media?.mimeType }); return { data: { id } }; },
      async update({ fileId, media }) { calls.update.push({ fileId, mimeType: media?.mimeType }); return { data: { id: fileId } }; },
      async delete({ fileId }) { calls.delete.push(fileId); for (const [n, i] of byName) if (i === fileId) byName.delete(n); return { data: {} }; },
      async get({ fileId }) { calls.get.push(fileId); return { data: Buffer.from(`DATA:${fileId}`) }; }
    }
  };
}

run("driveFileName joins prefix + blocks traversal; stripDrivePrefix reverses", () => {
  assert.equal(driveFileName("media", "a.jpg"), "media/a.jpg");
  assert.equal(driveFileName("", "x/y.png"), "x/y.png");
  assert.equal(driveFileName("/media/", "/a.jpg"), "media/a.jpg");
  assert.throws(() => driveFileName("media", "../escape"), /Invalid file key/);
  assert.equal(stripDrivePrefix("media", "media/a.jpg"), "a.jpg");
});

run("buildFileStore selects gdrive via FILE_STORE", () => {
  const prevF = process.env.GDRIVE_FOLDER_ID;
  const prevC = process.env.GDRIVE_CREDENTIALS;
  process.env.GDRIVE_FOLDER_ID = "folder123";
  process.env.GDRIVE_CREDENTIALS = JSON.stringify({ client_email: "svc@example.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----\\n" });
  try {
    const store = buildFileStore({ fileStore: "gdrive" });
    assert.equal(typeof store.putBlob, "function");
    assert.equal(typeof store.list, "function");
  } finally {
    if (prevF === undefined) delete process.env.GDRIVE_FOLDER_ID; else process.env.GDRIVE_FOLDER_ID = prevF;
    if (prevC === undefined) delete process.env.GDRIVE_CREDENTIALS; else process.env.GDRIVE_CREDENTIALS = prevC;
  }
});

run("putBlob creates new then updates existing (by name)", async () => {
  const drive = fakeDrive();
  const store = createGoogleDriveFileStore({ driveClient: drive, folderId: "F", prefix: "media" });
  const out = await store.putBlob("thumbs/a.jpg", Buffer.from("DATA"), { contentType: "image/jpeg" });
  assert.equal(drive.calls.create[0].name, "media/thumbs/a.jpg");
  assert.deepEqual(drive.calls.create[0].parents, ["F"]);
  assert.equal(drive.calls.create[0].mimeType, "image/jpeg");
  assert.equal(out.key, "thumbs/a.jpg");
  // second put with same key → update, not a second create
  await store.putBlob("thumbs/a.jpg", Buffer.from("DATA2"));
  assert.equal(drive.calls.create.length, 1);
  assert.equal(drive.calls.update.length, 1);
});

run("getBlob returns Buffer; null when name not found", async () => {
  const drive = fakeDrive({ "x.bin": "id1" });
  const store = createGoogleDriveFileStore({ driveClient: drive, folderId: "F" });
  const buf = await store.getBlob("x.bin");
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString(), "DATA:id1");
  assert.equal(await store.getBlob("missing"), null);
});

run("getUrl is null (server-proxied); remove is idempotent", async () => {
  const drive = fakeDrive({ "a.jpg": "id1" });
  const store = createGoogleDriveFileStore({ driveClient: drive, folderId: "F" });
  assert.equal(await store.getUrl("a.jpg"), null);
  await store.remove("a.jpg");
  assert.deepEqual(drive.calls.delete, ["id1"]);
  await store.remove("a.jpg"); // already gone → no throw, no extra delete
  assert.equal(drive.calls.delete.length, 1);
});

run("list strips prefix + filters by sub-prefix", async () => {
  const drive = fakeDrive({ "media/thumbs/a.jpg": "i1", "media/thumbs/b.jpg": "i2", "media/other/c.jpg": "i3" });
  const store = createGoogleDriveFileStore({ driveClient: drive, folderId: "F", prefix: "media" });
  const keys = await store.list("thumbs");
  assert.deepEqual(keys.sort(), ["thumbs/a.jpg", "thumbs/b.jpg"]);
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll Google Drive file store tests passed.");
});

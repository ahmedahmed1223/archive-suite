import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashBlob, putBlobChunked, UPLOAD_CHUNK_BYTES } from "./useChunkedUpload.js";

// ── hashBlob ─────────────────────────────────────────────────────────────────

describe("hashBlob", () => {
  it("falls back to pseudo-key when SubtleCrypto is unavailable", async () => {
    vi.stubGlobal("crypto", undefined);
    const blob = new Blob(["hello"], { type: "text/plain" });
    blob.name = "test.txt";
    const key = await hashBlob(blob);
    expect(key).toMatch(/^nohash-/);
    vi.unstubAllGlobals();
  });

  it("returns a 64-char hex string for a small blob", async () => {
    const blob = new Blob(["hello world"]);
    const key = await hashBlob(blob);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same content produces same hash", async () => {
    const blob1 = new Blob(["content"]);
    const blob2 = new Blob(["content"]);
    expect(await hashBlob(blob1)).toBe(await hashBlob(blob2));
  });

  it("different content produces different hash", async () => {
    const a = await hashBlob(new Blob(["aaa"]));
    const b = await hashBlob(new Blob(["bbb"]));
    expect(a).not.toBe(b);
  });

  it("calls onProgress with values between 0 and 1", async () => {
    const progress = [];
    const blob = new Blob(["x".repeat(100)]);
    await hashBlob(blob, (r) => progress.push(r));
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(1);
  });
});

// ── putBlobChunked ────────────────────────────────────────────────────────────

describe("putBlobChunked", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    globalThis.XMLHttpRequest = class {
      constructor() { this.upload = {}; }
      open(_m, url) { this._url = url; }
      setRequestHeader() {}
      send() {
        setTimeout(() => { this.status = 200; this.responseText = "{}"; this.onload?.(); }, 0);
      }
      addEventListener() {}
    };
  });

  it("inits session, uploads chunk via XHR, and completes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, uploadId: "test-uuid", chunkSize: UPLOAD_CHUNK_BYTES }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { key: "abc.mp4", url: "/api/files/abc.mp4" } }),
      });

    const blob = new Blob(["tiny"], { type: "video/mp4" });
    const result = await putBlobChunked({
      baseUrl: "",
      key: "abc.mp4",
      blob,
      getToken: () => "tok",
      onProgress: vi.fn(),
    });

    expect(result.key).toBe("abc.mp4");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/upload-sessions");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/upload-sessions/test-uuid/complete");
  });

  it("skips already-received chunks when resuming", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { key: "file.mp4" } }),
    });

    const sentUrls = [];
    globalThis.XMLHttpRequest = class {
      constructor() { this.upload = {}; }
      open(_m, url) { this._url = url; }
      setRequestHeader() {}
      send() {
        sentUrls.push(this._url);
        setTimeout(() => { this.status = 200; this.onload?.(); }, 0);
      }
      addEventListener() {}
    };

    // Two-chunk blob, chunk 0 already uploaded
    const twoChunkBlob = { size: UPLOAD_CHUNK_BYTES * 2, type: "", slice: (s, e) => new Blob(["x"]) };
    await putBlobChunked({
      baseUrl: "",
      key: "file.mp4",
      blob: twoChunkBlob,
      getToken: () => "tok",
      onProgress: vi.fn(),
      existingUploadId: "resume-id",
      existingReceivedIndices: [0],
    });

    // Only chunk 1 should be sent via XHR
    expect(sentUrls).toHaveLength(1);
    expect(sentUrls[0]).toContain("/chunks/1");
  });

  it("throws when init fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    const blob = new Blob(["data"]);
    await expect(
      putBlobChunked({ baseUrl: "", key: "x", blob, getToken: () => "", onProgress: vi.fn() })
    ).rejects.toThrow("Server error");
  });

  it("throws when complete fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, uploadId: "uid", chunkSize: UPLOAD_CHUNK_BYTES }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: "Upload incomplete" }),
      });

    const blob = new Blob(["data"]);
    await expect(
      putBlobChunked({ baseUrl: "", key: "x", blob, getToken: () => "", onProgress: vi.fn() })
    ).rejects.toThrow("Upload incomplete");
  });
});

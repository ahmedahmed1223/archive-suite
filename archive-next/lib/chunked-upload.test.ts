// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createArchiveApiClient, UploadedRecord, UploadSession } from "./archive-api";
import { abortChunkedUpload, uploadFileForSchedule, uploadFileInChunks } from "./chunked-upload";

type ArchiveApi = ReturnType<typeof createArchiveApiClient>;

function makeFile(content: string, name = "clip.mp4"): File {
  return new File([content], name, { type: "video/mp4", lastModified: 1_700_000_000_000 });
}

function baseSession(overrides: Partial<UploadSession> = {}): UploadSession {
  return {
    id: "session-1",
    fileName: "clip.mp4",
    totalSize: 20,
    chunkSize: 10,
    totalChunks: 2,
    receivedChunks: [],
    status: "pending",
    expiresAt: new Date().toISOString(),
    ...overrides
  };
}

const fakeRecord: UploadedRecord = {
  id: "record-1",
  title: "clip.mp4",
  fileName: "clip.mp4",
  filePath: "ingest/uploads/record-1.mp4",
  checksum: "abc123",
  source: "upload"
};

describe("uploadFileInChunks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a session, uploads every chunk in order, and completes", async () => {
    const uploadedIndexes: number[] = [];
    const api = {
      createUploadSession: vi.fn().mockResolvedValue({ ok: true, session: baseSession() }),
      uploadSessionChunk: vi.fn().mockImplementation((_id: string, index: number) => {
        uploadedIndexes.push(index);
        return Promise.resolve({ ok: true, receivedChunks: [index], totalChunks: 2 });
      }),
      completeUploadSession: vi.fn().mockResolvedValue({ ok: true, record: fakeRecord }),
      uploadSessionStatus: vi.fn(),
      abortUploadSession: vi.fn()
    } as unknown as ArchiveApi;

    const progress: number[] = [];
    const result = await uploadFileInChunks(api, makeFile("a".repeat(10) + "b".repeat(10)), {
      onProgress: (p) => progress.push(p.uploadedBytes)
    });

    expect(result).toEqual({ ok: true, record: fakeRecord });
    expect(uploadedIndexes).toEqual([0, 1]);
    expect(progress).toEqual([0, 10, 20]);
    expect(api.completeUploadSession).toHaveBeenCalledWith("session-1");
  });

  it("resumes from the server's receivedChunks after a prior partial attempt", async () => {
    const file = makeFile("a".repeat(10) + "b".repeat(10));
    const createUploadSession = vi.fn().mockResolvedValue({ ok: true, session: baseSession() });
    let chunkAttempt = 0;
    const uploadSessionChunk = vi.fn().mockImplementation((_id: string, index: number) => {
      chunkAttempt += 1;
      if (index === 1 && chunkAttempt === 2) {
        return Promise.resolve({ ok: false, error: "network drop" });
      }
      return Promise.resolve({ ok: true, receivedChunks: [index], totalChunks: 2 });
    });
    const completeUploadSession = vi.fn().mockResolvedValue({ ok: true, record: fakeRecord });
    const uploadSessionStatus = vi.fn().mockResolvedValue({
      ok: true,
      session: baseSession({ receivedChunks: [0], status: "pending" })
    });

    const api = {
      createUploadSession,
      uploadSessionChunk,
      completeUploadSession,
      uploadSessionStatus,
      abortUploadSession: vi.fn()
    } as unknown as ArchiveApi;

    const first = await uploadFileInChunks(api, file);
    expect(first).toEqual({ ok: false, error: "network drop" });
    expect(createUploadSession).toHaveBeenCalledTimes(1);

    const resumeCalls: boolean[] = [];
    const second = await uploadFileInChunks(api, file, {
      onProgress: (p) => resumeCalls.push(p.resuming)
    });

    expect(second).toEqual({ ok: true, record: fakeRecord });
    // Second attempt resumes via status, not a fresh session.
    expect(createUploadSession).toHaveBeenCalledTimes(1);
    expect(uploadSessionStatus).toHaveBeenCalledWith("session-1");
    expect(resumeCalls.every(Boolean)).toBe(true);
    // Chunk 0 is never retried once the server confirms it as received.
    const secondAttemptChunkIndexes = uploadSessionChunk.mock.calls.slice(2).map((call) => call[1]);
    expect(secondAttemptChunkIndexes).toEqual([1]);
  });

  it("starts a fresh session when the resumed one is no longer pending", async () => {
    const file = makeFile("a".repeat(10) + "b".repeat(10));
    const createUploadSession = vi.fn().mockResolvedValue({ ok: true, session: baseSession() });
    const uploadSessionChunk = vi.fn().mockResolvedValue({ ok: true, receivedChunks: [0], totalChunks: 2 });
    const completeUploadSession = vi.fn().mockResolvedValue({ ok: true, record: fakeRecord });
    const uploadSessionStatus = vi.fn().mockResolvedValue({
      ok: true,
      session: baseSession({ status: "aborted" })
    });

    const api = {
      createUploadSession,
      uploadSessionChunk,
      completeUploadSession,
      uploadSessionStatus,
      abortUploadSession: vi.fn()
    } as unknown as ArchiveApi;

    window.localStorage.setItem(
      "archive.chunked-upload.sessions",
      JSON.stringify({ [`${file.name}::${file.size}::${file.lastModified}::`]: { sessionId: "stale-session" } })
    );

    const result = await uploadFileInChunks(api, file);

    expect(result).toEqual({ ok: true, record: fakeRecord });
    expect(uploadSessionStatus).toHaveBeenCalledWith("stale-session");
    expect(createUploadSession).toHaveBeenCalledTimes(1);
  });
});

describe("uploadFileForSchedule", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stages the session and uploads every chunk without completing it", async () => {
    const uploadedIndexes: number[] = [];
    const completeUploadSession = vi.fn();
    const api = {
      createUploadSession: vi.fn().mockResolvedValue({ ok: true, session: baseSession() }),
      uploadSessionChunk: vi.fn().mockImplementation((_id: string, index: number) => {
        uploadedIndexes.push(index);
        return Promise.resolve({ ok: true, receivedChunks: [index], totalChunks: 2 });
      }),
      completeUploadSession,
      uploadSessionStatus: vi.fn(),
      abortUploadSession: vi.fn()
    } as unknown as ArchiveApi;

    const result = await uploadFileForSchedule(api, makeFile("a".repeat(10) + "b".repeat(10)));

    expect(result).toEqual({ ok: true, sessionId: "session-1" });
    expect(uploadedIndexes).toEqual([0, 1]);
    expect(completeUploadSession).not.toHaveBeenCalled();
  });

  it("propagates a chunk upload failure instead of staging a broken session", async () => {
    const api = {
      createUploadSession: vi.fn().mockResolvedValue({ ok: true, session: baseSession() }),
      uploadSessionChunk: vi.fn().mockResolvedValue({ ok: false, error: "network drop" }),
      completeUploadSession: vi.fn(),
      uploadSessionStatus: vi.fn(),
      abortUploadSession: vi.fn()
    } as unknown as ArchiveApi;

    const result = await uploadFileForSchedule(api, makeFile("a".repeat(10) + "b".repeat(10)));

    expect(result).toEqual({ ok: false, error: "network drop" });
  });
});

describe("abortChunkedUpload", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does nothing when there is no resume entry for the file", async () => {
    const abortUploadSession = vi.fn();
    const api = { abortUploadSession } as unknown as ArchiveApi;

    await abortChunkedUpload(api, makeFile("x"));

    expect(abortUploadSession).not.toHaveBeenCalled();
  });

  it("aborts the server session and clears the resume entry", async () => {
    const file = makeFile("x");
    const key = `${file.name}::${file.size}::${file.lastModified}::`;
    window.localStorage.setItem(
      "archive.chunked-upload.sessions",
      JSON.stringify({ [key]: { sessionId: "session-9" } })
    );
    const abortUploadSession = vi.fn().mockResolvedValue({ ok: true });
    const api = { abortUploadSession } as unknown as ArchiveApi;

    await abortChunkedUpload(api, file);

    expect(abortUploadSession).toHaveBeenCalledWith("session-9");
    const stored = JSON.parse(window.localStorage.getItem("archive.chunked-upload.sessions") ?? "{}");
    expect(stored[key]).toBeUndefined();
  });
});

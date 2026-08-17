import { describe, expect, it, vi } from "vitest";
import { createMediaReviewClient, type MediaReviewRequestKit } from "./media-review";

function makeKit(overrides: Partial<MediaReviewRequestKit> = {}): MediaReviewRequestKit {
  return {
    get: vi.fn().mockResolvedValue({ ok: true }),
    post: vi.fn().mockResolvedValue({ ok: true }),
    patch: vi.fn().mockResolvedValue({ ok: true }),
    del: vi.fn().mockResolvedValue({ ok: true }),
    fetchImpl: vi.fn(),
    baseUrl: "/api/v1",
    currentLocale: () => "en",
    getAccessToken: () => undefined,
    clientUploadError: (_locale, kind, status) => `error:${kind}:${status ?? ""}`,
    ...overrides
  };
}

describe("createMediaReviewClient", () => {
  it("builds review-session routes and forwards query params", async () => {
    const kit = makeKit();
    const client = createMediaReviewClient(kit);

    await client.reviewSessions("rec-1", { store: "archive-items", attachmentId: "att-1" });
    expect(kit.get).toHaveBeenCalledWith("/records/rec-1/review-sessions?store=archive-items&attachmentId=att-1", undefined);

    await client.createReviewSession("rec-1", { note: "hi" } as never);
    expect(kit.post).toHaveBeenCalledWith("/records/rec-1/review-sessions", { note: "hi" }, undefined);

    await client.transitionReviewSession("sess-1", "approve");
    expect(kit.post).toHaveBeenCalledWith("/review-sessions/sess-1/approve", {}, undefined);
  });

  it("routes media clip CRUD through the matching HTTP verb", async () => {
    const kit = makeKit();
    const client = createMediaReviewClient(kit);

    await client.mediaClips("rec-1");
    expect(kit.get).toHaveBeenCalledWith("/records/rec-1/clips", undefined);

    await client.createMediaClip("rec-1", { inSeconds: 0, outSeconds: 1 } as never);
    expect(kit.post).toHaveBeenCalledWith("/records/rec-1/clips", { inSeconds: 0, outSeconds: 1 }, undefined);

    await client.updateMediaClip("clip-1", { label: "x" } as never);
    expect(kit.patch).toHaveBeenCalledWith("/clips/clip-1", { label: "x" }, undefined);

    await client.deleteMediaClip("clip-1");
    expect(kit.del).toHaveBeenCalledWith("/clips/clip-1", undefined, undefined);
  });

  it("routes transcript version endpoints, including lock and restore", async () => {
    const kit = makeKit();
    const client = createMediaReviewClient(kit);

    await client.transcriptVersions("rec-1", { store: "archive-items" });
    expect(kit.get).toHaveBeenCalledWith("/records/rec-1/transcript/versions?store=archive-items", undefined);

    await client.lockTranscriptVersion("rec-1");
    expect(kit.post).toHaveBeenCalledWith("/records/rec-1/transcript/lock", {}, undefined);

    await client.restoreTranscriptVersion("rec-1", "ver-1");
    expect(kit.post).toHaveBeenCalledWith("/records/rec-1/transcript/versions/ver-1/restore", {}, undefined);
  });

  it("resolves and reopens media review comments via POST", async () => {
    const kit = makeKit();
    const client = createMediaReviewClient(kit);

    await client.resolveMediaReviewComment("comment-1");
    expect(kit.post).toHaveBeenCalledWith("/media-review-comments/comment-1/resolve", undefined, undefined);

    await client.reopenMediaReviewComment("comment-1");
    expect(kit.post).toHaveBeenCalledWith("/media-review-comments/comment-1/reopen", undefined, undefined);
  });

  it("fetches the media job queue status", async () => {
    const kit = makeKit();
    const client = createMediaReviewClient(kit);

    await client.mediaJobQueueStatus();
    expect(kit.get).toHaveBeenCalledWith("/media/jobs/queue-status", undefined);
  });

  describe("downloadMediaClipsExport", () => {
    it("returns the blob and a filename derived from content-disposition on success", async () => {
      const blob = new Blob(["a,b"], { type: "text/csv" });
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-disposition": 'attachment; filename="clips.csv"' }),
        blob: () => Promise.resolve(blob)
      });
      const kit = makeKit({ fetchImpl, getAccessToken: () => "token-123" });
      const client = createMediaReviewClient(kit);

      const result = await client.downloadMediaClipsExport("rec-1", "csv");

      expect(fetchImpl).toHaveBeenCalledWith(
        "/api/v1/records/rec-1/clips/export?format=csv",
        expect.objectContaining({ credentials: "include" })
      );
      const [, init] = fetchImpl.mock.calls[0];
      expect((init.headers as Headers).get("Authorization")).toBe("Bearer token-123");
      expect(result).toEqual({ ok: true, blob, filename: "clips.csv" });
    });

    it("falls back to a generated filename when content-disposition is absent", async () => {
      const blob = new Blob(["{}"], { type: "application/json" });
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        blob: () => Promise.resolve(blob)
      });
      const kit = makeKit({ fetchImpl });
      const client = createMediaReviewClient(kit);

      const result = await client.downloadMediaClipsExport("rec-1", "json");

      expect(result).toEqual({ ok: true, blob, filename: "clip-list-rec-1.json" });
    });

    it("returns a translated error when the response is not ok", async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
      const kit = makeKit({ fetchImpl });
      const client = createMediaReviewClient(kit);

      const result = await client.downloadMediaClipsExport("rec-1", "csv");

      expect(result).toEqual({ ok: false, error: "error:export:500" });
    });

    it("returns a network error when fetch throws", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
      const kit = makeKit({ fetchImpl, currentLocale: () => "ar" });
      const client = createMediaReviewClient(kit);

      const result = await client.downloadMediaClipsExport("rec-1", "csv");

      expect(result).toEqual({ ok: false, error: "تعذر الاتصال بالخادم لتصدير قائمة المقاطع." });
    });
  });
});

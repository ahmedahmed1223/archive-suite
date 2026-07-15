import { describe, expect, it, vi } from "vitest";
import { createArchiveApiClient } from "./archive-api";

describe("archive API uploads", () => {
  it("uses the access token issued by login for multipart uploads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        ok: true,
        user: { id: "admin", email: "admin@example.test", role: "admin" },
        accessToken: "live-access-token",
        expiresAt: "2030-01-01T00:00:00.000Z"
      }))
      .mockResolvedValueOnce(Response.json({
        ok: true,
        record: { id: "upload-1", uid: "upload-1", fileName: "acceptance.wav", filePath: "uploads/acceptance.wav", checksum: "checksum", source: "upload" }
      }));
    const api = createArchiveApiClient({ baseUrl: "http://archive.test/api/v1", fetchImpl });

    await api.login({ email: "admin@example.test", password: "not-a-real-password" });
    await api.uploadFile(new File(["audio"], "acceptance.wav", { type: "audio/wav" }));

    const uploadRequest = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(uploadRequest.headers).get("Authorization")).toBe("Bearer live-access-token");
  });
});

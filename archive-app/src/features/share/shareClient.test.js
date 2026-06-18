import { describe, expect, it, vi } from "vitest";

import { mintShareLink, revokeShareLink } from "./shareClient.js";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("shareClient", () => {
  it("returns the revocation jti when minting a share link", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true,
      result: {
        token: "share-token",
        title: "مجموعة",
        expiresAt: "2026-07-18T00:00:00.000Z",
        jti: "share-jti",
        passwordProtected: true
      }
    }));

    const result = await mintShareLink({
      scope: { type: "collection", ids: ["c1"], permission: "view" },
      getToken: () => "jwt-token",
      fetchImpl,
      origin: "https://app.example.test"
    });

    expect(result).toMatchObject({
      token: "share-token",
      url: "https://app.example.test/?share=share-token",
      jti: "share-jti",
      passwordProtected: true
    });
  });

  it("revokes a minted share link by jti", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true,
      result: { revoked: true, jti: "share-jti" }
    }));

    const result = await revokeShareLink({
      jti: "share-jti",
      baseUrl: "https://api.example.test",
      getToken: () => "jwt-token",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.test/api/share/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer jwt-token" },
      body: JSON.stringify({ jti: "share-jti" })
    });
    expect(result).toEqual({ revoked: true, jti: "share-jti" });
  });
});

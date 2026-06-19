import { describe, expect, it, vi } from "vitest";

import { inviteShareByEmail, mintShareLink, revokeShareLink } from "./shareClient.js";

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

  it("sends a scoped share invitation by email", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true,
      result: {
        token: "invite-token",
        invitation: { email: "reviewer@example.test", shareJti: "invite-jti" },
        emailStatus: { sent: true }
      }
    }));

    const result = await inviteShareByEmail({
      email: "reviewer@example.test",
      message: "راجع هذه المادة",
      scope: { type: "items", ids: ["v1"], permission: "comment" },
      title: "مراجعة",
      expiresInDays: 7,
      baseUrl: "https://api.example.test",
      getToken: () => "jwt-token",
      fetchImpl,
      origin: "https://app.example.test"
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.test/api/share/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer jwt-token" },
      body: JSON.stringify({
        email: "reviewer@example.test",
        message: "راجع هذه المادة",
        scope: { type: "items", ids: ["v1"], permission: "comment" },
        title: "مراجعة",
        expiresInDays: 7
      })
    });
    expect(result).toMatchObject({
      token: "invite-token",
      url: "https://app.example.test/?share=invite-token",
      jti: "invite-jti",
      emailStatus: { sent: true }
    });
  });
});

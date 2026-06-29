/**
 * Integration tests for POST /api/auth/refresh (§20.1).
 *
 * The refresh endpoint:
 *  1. Reads va_refresh HttpOnly cookie
 *  2. Rotates the refresh token (issuing a new cookie)
 *  3. Returns a fresh short-lived access token in the JSON body
 *  4. Returns 401 when the cookie is missing or the token is invalid/reused
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiServer } from "../server.js";
import { signJwt } from "../../auth/jwt.js";
import { issueRefreshToken } from "../../auth/refreshTokenStore.js";

const SECRET = "auth-refresh-test-secret-32-chars!";

function buildRefreshCookie(token: string) {
  return `va_refresh=${encodeURIComponent(token)}`;
}

describe("POST /api/auth/refresh", () => {
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    server = createApiServer({
      authSecret: SECRET,
      rateLimit: null,
      resolveStorage: () => ({ ping: async () => {} })
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function postRefresh(cookieHeader?: string | null) {
    return fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: cookieHeader ? { Cookie: cookieHeader } : {}
    });
  }

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await postRefresh(null);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect((body as any).ok).toBe(false);
  });

  it("returns a new access token and rotates the cookie on valid refresh token", async () => {
    const { token } = issueRefreshToken(
      { sub: "u_test", username: "testuser", role: "editor" },
      SECRET
    );
    const res = await postRefresh(buildRefreshCookie(token));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect((body as any).ok).toBe(true);
    expect(typeof (body as any).token).toBe("string");
    expect((body as any).user).toMatchObject({ id: "u_test", username: "testuser" });

    // The server must set a new HttpOnly cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("va_refresh=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });

  it("returns 401 and clears the cookie when a rotated (retired) token is replayed", async () => {
    const { token } = issueRefreshToken(
      { sub: "u_reuse", username: "reusetest", role: "viewer" },
      SECRET
    );
    // First rotate — token is now retired
    const first = await postRefresh(buildRefreshCookie(token));
    expect(first.status).toBe(200);

    // Replay the same (now-retired) token — should detect reuse
    const second = await postRefresh(buildRefreshCookie(token));
    expect(second.status).toBe(401);

    // Cookie should be cleared (Max-Age=0)
    const setCookie = second.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 401 for a completely invalid refresh token value", async () => {
    const res = await postRefresh(buildRefreshCookie("not.a.valid.jwt.at.all"));
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect((body as any).ok).toBe(false);
  });
});

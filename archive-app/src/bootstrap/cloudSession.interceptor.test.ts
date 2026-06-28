/**
 * Tests for the client-side 401 auto-refresh behavior (§20.1).
 *
 * The cloud session provider must:
 *  1. Keep the access token in memory (not re-read from localStorage on each call)
 *  2. Call /api/auth/refresh with `credentials:"include"` so the HttpOnly cookie
 *     is sent automatically
 *  3. On a 401 from the refresh endpoint, surface the error via onExpired
 *     (so the app can route back to login)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCloudSessionProvider,
  getCloudToken,
  clearCloudToken,
  CloudLoginError
} from "./cloudSession.js";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => map.set(k, String(v)),
    removeItem: (k: string) => map.delete(k)
  };
}

function fakeJwt(payload: Record<string, unknown>) {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
}

beforeEach(() => {
  clearCloudToken();
});

describe("refreshCloudToken — credentials mode", () => {
  it("sends credentials:include so the HttpOnly cookie is forwarded automatically", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true, token: "new-token", user: { id: "u1", username: "alice" } })
    }));

    const provider = createCloudSessionProvider({
      baseUrl: "https://api.test",
      fetchImpl,
      storage,
      silentRenewal: false
    });

    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        ok: true,
        token: fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: { id: "u1", username: "alice" }
      })
    });
    await provider.signIn({ username: "alice", password: "pw" });

    fetchImpl.mockClear();
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true, token: "refreshed-token", user: { id: "u1", username: "alice" } })
    });

    const { refreshCloudToken } = await import("./cloudSession.js");
    await refreshCloudToken({ baseUrl: "https://api.test", fetchImpl, storage });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/api/auth/refresh",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});

describe("createCloudSessionProvider — 401 on refresh", () => {
  it("clears stored credentials and fires onExpired when refresh returns 401", async () => {
    const storage = memoryStorage();
    storage.setItem("va.cloudToken.v1", "stale-access-token");
    storage.setItem("va.cloudUser.v1", JSON.stringify({ id: "u1", username: "alice" }));

    const onExpired = vi.fn();
    const timers: Array<{ fn: () => void | Promise<void>; delay?: number }> = [];

    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: false, error: "session expired" })
    }));

    createCloudSessionProvider({
      baseUrl: "",
      fetchImpl,
      storage,
      silentRenewal: true
    });

    const { createSilentRenewal } = await import("./cloudSession.js");
    const renewal = createSilentRenewal({
      fetchImpl,
      storage,
      onExpired,
      setTimer: (fn, delay) => {
        timers.push({ fn, delay });
        return (timers.length - 1) as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {}
    });

    renewal.start(fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 600 }));
    await timers[0].fn();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onExpired.mock.calls[0][0]).toBeInstanceOf(CloudLoginError);
    expect(onExpired.mock.calls[0][0].status).toBe(401);
  });
});

describe("createCloudSessionProvider — signOut clears storage", () => {
  it("removes the access token and user from storage on signOut", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        ok: true,
        token: fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: { id: "u1", username: "alice" }
      })
    }));

    const provider = createCloudSessionProvider({
      baseUrl: "",
      fetchImpl,
      storage,
      silentRenewal: false
    });

    await provider.signIn({ username: "alice", password: "pw" });

    expect(getCloudToken()).toBeTruthy();

    await provider.signOut();

    expect(getCloudToken()).toBeFalsy();
    expect(storage.getItem("va.cloudToken.v1")).toBeNull();
    expect(storage.getItem("va.cloudUser.v1")).toBeNull();
  });
});

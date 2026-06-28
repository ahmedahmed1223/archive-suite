import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  refreshCloudToken,
  getTokenExpiryMs,
  createSilentRenewal,
  CloudLoginError,
  getCloudToken,
  clearCloudToken
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
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

beforeEach(() => {
  clearCloudToken();
});

describe("refreshCloudToken", () => {
  it("posts with credentials and keeps the new token in memory (not localStorage)", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: "new-token", user: { id: "u1", username: "admin" } })
    }));

    const result = await refreshCloudToken({ baseUrl: "https://api.test", fetchImpl, storage });

    expect(result.token).toBe("new-token");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/api/auth/refresh",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(getCloudToken()).toBe("new-token");
    expect(storage.getItem("va.cloudToken.v1")).toBeNull();
    expect(JSON.parse(storage.getItem("va.cloudUser.v1")!)).toEqual({ id: "u1", username: "admin" });
  });

  it("throws CloudLoginError with status on a 401", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: "expired" })
    }));

    await expect(refreshCloudToken({ fetchImpl, storage })).rejects.toMatchObject({
      name: "CloudLoginError",
      status: 401
    });
  });
});

describe("getTokenExpiryMs", () => {
  it("reads exp (seconds) as ms epoch", () => {
    expect(getTokenExpiryMs(fakeJwt({ sub: "u1", exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it("returns null for garbage", () => {
    expect(getTokenExpiryMs("not-a-jwt")).toBeNull();
    expect(getTokenExpiryMs("")).toBeNull();
  });
});

describe("createSilentRenewal", () => {
  it("schedules renewal ~1 min before expiry and reschedules from the new token", async () => {
    const storage = memoryStorage();
    const nowMs = 1_000_000_000_000;
    const firstToken = fakeJwt({ sub: "u1", exp: (nowMs + 10 * 60_000) / 1000 });
    const nextToken = fakeJwt({ sub: "u1", exp: (nowMs + 20 * 60_000) / 1000 });

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: nextToken, user: { id: "u1" } })
    }));

    const timers: Array<{ fn: () => void | Promise<void>; delay?: number }> = [];
    const renewal = createSilentRenewal({
      fetchImpl,
      storage,
      now: () => nowMs,
      setTimer: (fn, delay) => {
        timers.push({ fn, delay });
        return (timers.length - 1) as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {}
    });

    renewal.start(firstToken);
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(10 * 60_000 - 60_000);

    await timers[0].fn();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getCloudToken()).toBe(nextToken);
    expect(timers).toHaveLength(2);
    expect(timers[1].delay).toBe(20 * 60_000 - 60_000);
  });

  it("stops and calls onExpired when refresh returns 401", async () => {
    const storage = memoryStorage();
    const onExpired = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: "dead session" })
    }));

    const timers: Array<{ fn: () => void | Promise<void>; delay?: number }> = [];
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

    renewal.start(fakeJwt({ sub: "u1", exp: Date.now() / 1000 + 600 }));
    await timers[0].fn();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onExpired.mock.calls[0][0]).toBeInstanceOf(CloudLoginError);
    expect(timers).toHaveLength(1);
  });

  it("retries on network failure instead of giving up", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const timers: Array<{ fn: () => void | Promise<void>; delay?: number }> = [];
    const renewal = createSilentRenewal({
      fetchImpl,
      storage,
      setTimer: (fn, delay) => {
        timers.push({ fn, delay });
        return (timers.length - 1) as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {}
    });

    renewal.start(fakeJwt({ sub: "u1", exp: Date.now() / 1000 + 600 }));
    await timers[0].fn();

    expect(timers).toHaveLength(2);
    expect(timers[1].delay).toBe(5_000);
  });
});

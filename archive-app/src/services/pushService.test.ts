import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  urlBase64ToUint8Array,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush
} from "./pushService.js";
import { setCloudToken, clearCloudToken } from "../bootstrap/cloudSession.js";

function memoryStorage(token = "jwt-token") {
  const map = new Map([["va.cloudToken.v1", token]]);
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => map.set(k, String(v)),
    removeItem: (k: string) => map.delete(k)
  };
}

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url into bytes", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
  });

  it("handles url-safe characters and missing padding", () => {
    const out = urlBase64ToUint8Array("_-8");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("isPushSupported", () => {
  it("is false when PushManager is missing", () => {
    expect(isPushSupported({ navigator: {} })).toBe(false);
  });

  it("is true when serviceWorker + PushManager + Notification exist", () => {
    expect(
      isPushSupported({ navigator: { serviceWorker: {} }, PushManager: {}, Notification: {} })
    ).toBe(true);
  });
});

describe("subscribeToPush", () => {
  beforeEach(() => { setCloudToken("jwt-token"); });
  afterEach(() => { clearCloudToken(); });

  function happyDeps() {
    const subscription = {
      endpoint: "https://push.test/ep1",
      toJSON: () => ({ endpoint: "https://push.test/ep1", keys: { p256dh: "p", auth: "a" } })
    };
    const registration: any = {
      pushManager: { subscribe: vi.fn(async () => subscription), getSubscription: vi.fn(async () => subscription) }
    };
    const notification: any = { requestPermission: vi.fn(async (): Promise<NotificationPermission> => "granted") };
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/push/vapid-public-key")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, key: "AQID" }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    return { registration, notification, fetchImpl };
  }

  it("requests permission, fetches the VAPID key, subscribes, and saves to the server", async () => {
    const { registration, notification, fetchImpl } = happyDeps();
    const storage = memoryStorage();

    const result = await subscribeToPush({ baseUrl: "https://api.test", fetchImpl, registration, notification, storage });

    expect(result.subscribed).toBe(true);
    expect(notification.requestPermission).toHaveBeenCalled();
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    const calls: any[] = fetchImpl.mock.calls;
    expect(calls[0][0]).toBe("https://api.test/api/push/vapid-public-key");
    expect((calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer jwt-token" });
    expect(calls[1][0]).toBe("https://api.test/api/push/subscribe");
    expect(JSON.parse((calls[1][1] as RequestInit).body as string).subscription.endpoint).toBe("https://push.test/ep1");
  });

  it("throws when permission is denied", async () => {
    const { registration, fetchImpl } = happyDeps();
    const notification: any = { requestPermission: vi.fn(async (): Promise<NotificationPermission> => "denied") };

    await expect(
      subscribeToPush({ fetchImpl, registration, notification, storage: memoryStorage() })
    ).rejects.toThrow(/إذن/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws the server error when VAPID is not configured", async () => {
    const { registration, notification } = happyDeps();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 501,
      json: async () => ({ ok: false, error: "Web Push غير مهيأ على هذا الخادم (VAPID keys)." })
    }));

    await expect(
      subscribeToPush({ fetchImpl, registration, notification, storage: memoryStorage() })
    ).rejects.toThrow(/غير مهيأ/);
  });
});

describe("unsubscribeFromPush", () => {
  it("unsubscribes locally and tells the server", async () => {
    const subscription = { endpoint: "https://push.test/ep1", unsubscribe: vi.fn(async () => true) };
    const registration: any = { pushManager: { getSubscription: vi.fn(async () => subscription) } };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));

    const result = await unsubscribeFromPush({ baseUrl: "https://api.test", fetchImpl, registration, storage: memoryStorage() });

    expect(result.subscribed).toBe(false);
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/api/push/unsubscribe",
      expect.objectContaining({ method: "POST" })
    );
    const calls: any[] = fetchImpl.mock.calls;
    expect(JSON.parse((calls[0][1] as RequestInit).body as string).endpoint).toBe("https://push.test/ep1");
  });

  it("is a no-op when there is no subscription", async () => {
    const registration: any = { pushManager: { getSubscription: vi.fn(async () => null) } };
    const fetchImpl = vi.fn();

    const result = await unsubscribeFromPush({ fetchImpl, registration, storage: memoryStorage() });

    expect(result.subscribed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

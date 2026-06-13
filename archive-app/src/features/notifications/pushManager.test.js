import { describe, it, expect, vi } from "vitest";
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  shouldAlertBrowser,
  notifyForAppNotification,
} from "./pushManager.js";

function makeNotificationClass(permission = "granted", requestResult = "granted") {
  class FakeNotification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
      FakeNotification.instances.push(this);
    }
  }
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = vi.fn(async () => requestResult);
  FakeNotification.instances = [];
  return FakeNotification;
}

function scopeWith(Notification, visibility = "hidden") {
  return { Notification, document: { visibilityState: visibility } };
}

describe("isBrowserNotificationSupported", () => {
  it("is false when Notification is missing", () => {
    expect(isBrowserNotificationSupported({ scope: {} })).toBe(false);
  });

  it("is true when Notification exists", () => {
    expect(isBrowserNotificationSupported({ scope: scopeWith(makeNotificationClass()) })).toBe(true);
  });
});

describe("getNotificationPermission", () => {
  it("returns unsupported when no Notification", () => {
    expect(getNotificationPermission({ scope: {} })).toBe("unsupported");
  });

  it("reflects the current permission", () => {
    expect(getNotificationPermission({ scope: scopeWith(makeNotificationClass("denied")) })).toBe("denied");
  });
});

describe("requestNotificationPermission", () => {
  it("returns unsupported without Notification", async () => {
    expect(await requestNotificationPermission({ scope: {} })).toBe("unsupported");
  });

  it("does not re-prompt when already granted", async () => {
    const Notif = makeNotificationClass("granted");
    const result = await requestNotificationPermission({ scope: scopeWith(Notif) });
    expect(result).toBe("granted");
    expect(Notif.requestPermission).not.toHaveBeenCalled();
  });

  it("prompts when permission is default", async () => {
    const Notif = makeNotificationClass("default", "granted");
    const result = await requestNotificationPermission({ scope: scopeWith(Notif) });
    expect(result).toBe("granted");
    expect(Notif.requestPermission).toHaveBeenCalledOnce();
  });

  it("never throws when requestPermission rejects", async () => {
    const Notif = makeNotificationClass("default");
    Notif.requestPermission = vi.fn(async () => {
      throw new Error("blocked");
    });
    expect(await requestNotificationPermission({ scope: scopeWith(Notif) })).toBe("default");
  });
});

describe("showBrowserNotification", () => {
  it("returns null when permission is not granted", () => {
    const Notif = makeNotificationClass("default");
    expect(showBrowserNotification("hi", {}, { scope: scopeWith(Notif) })).toBeNull();
    expect(Notif.instances).toHaveLength(0);
  });

  it("constructs a notification when granted", () => {
    const Notif = makeNotificationClass("granted");
    const result = showBrowserNotification("Title", { body: "Body", tag: "t1" }, { scope: scopeWith(Notif) });
    expect(result).not.toBeNull();
    expect(Notif.instances).toHaveLength(1);
    expect(Notif.instances[0].title).toBe("Title");
    expect(Notif.instances[0].options.body).toBe("Body");
    expect(Notif.instances[0].options.tag).toBe("t1");
  });
});

describe("shouldAlertBrowser", () => {
  it("is false without permission", () => {
    expect(shouldAlertBrowser({ type: "success" }, { scope: scopeWith(makeNotificationClass("default")) })).toBe(false);
  });

  it("is false when the tab is visible and not forced", () => {
    const scope = scopeWith(makeNotificationClass("granted"), "visible");
    expect(shouldAlertBrowser({ type: "success" }, { scope })).toBe(false);
  });

  it("is true when hidden + granted + alert-worthy type", () => {
    const scope = scopeWith(makeNotificationClass("granted"), "hidden");
    expect(shouldAlertBrowser({ type: "error" }, { scope })).toBe(true);
  });

  it("skips plain info even when hidden", () => {
    const scope = scopeWith(makeNotificationClass("granted"), "hidden");
    expect(shouldAlertBrowser({ type: "info" }, { scope })).toBe(false);
  });

  it("is true when forced regardless of visibility", () => {
    const scope = scopeWith(makeNotificationClass("granted"), "visible");
    expect(shouldAlertBrowser({ type: "info" }, { scope, force: true })).toBe(true);
  });
});

describe("notifyForAppNotification", () => {
  it("fires a tagged browser notification for a hidden success", () => {
    const Notif = makeNotificationClass("granted");
    const result = notifyForAppNotification(
      { id: "abc", title: "Done", message: "Export finished", type: "success" },
      { scope: scopeWith(Notif, "hidden") }
    );
    expect(result).not.toBeNull();
    expect(Notif.instances[0].title).toBe("Done");
    expect(Notif.instances[0].options.tag).toBe("archive-abc");
  });

  it("returns null when policy rejects it", () => {
    const Notif = makeNotificationClass("granted");
    const result = notifyForAppNotification(
      { id: "abc", type: "info" },
      { scope: scopeWith(Notif, "hidden") }
    );
    expect(result).toBeNull();
    expect(Notif.instances).toHaveLength(0);
  });
});

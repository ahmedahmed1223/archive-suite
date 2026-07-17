import { describe, expect, it } from "vitest";
import { getNewCompletionNotifications, notificationRequestHeaders, type Notification } from "./use-notifications";

describe("notificationRequestHeaders", () => {
  it("sends the current access token to protected notification endpoints", () => {
    expect(notificationRequestHeaders("live-access-token")).toEqual({
      Authorization: "Bearer live-access-token",
    });
  });
});

function makeNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 1,
    user_id: "user-1",
    type: "ingest_complete",
    title: "اكتمل الاستيراد",
    message: "تم استيراد الملفات بنجاح.",
    is_read: false,
    created_at: "2026-07-17T10:00:00Z",
    updated_at: "2026-07-17T10:00:00Z",
    ...overrides,
  };
}

describe("getNewCompletionNotifications", () => {
  it("identifies a newly-arrived task-completion notification", () => {
    const previous: Notification[] = [];
    const next = [makeNotification({ id: 1, type: "ingest_complete" })];

    expect(getNewCompletionNotifications(previous, next)).toEqual(next);
  });

  it("ignores notifications already present in the previous list", () => {
    const shared = makeNotification({ id: 1, type: "backup_result" });
    const previous = [shared];
    const next = [shared];

    expect(getNewCompletionNotifications(previous, next)).toEqual([]);
  });

  it("ignores newly-arrived notifications that are not task completions", () => {
    const previous: Notification[] = [];
    const next = [makeNotification({ id: 1, type: "share_event" })];

    expect(getNewCompletionNotifications(previous, next)).toEqual([]);
  });

  it("returns only the new completion entries out of a mixed batch", () => {
    const seen = makeNotification({ id: 1, type: "restore_result" });
    const newCompletion = makeNotification({ id: 2, type: "restore_result" });
    const newNonCompletion = makeNotification({ id: 3, type: "share_event" });
    const previous = [seen];
    const next = [seen, newCompletion, newNonCompletion];

    expect(getNewCompletionNotifications(previous, next)).toEqual([newCompletion]);
  });
});

import { describe, expect, it } from "vitest";
import { notificationRequestHeaders } from "./use-notifications";

describe("notificationRequestHeaders", () => {
  it("sends the current access token to protected notification endpoints", () => {
    expect(notificationRequestHeaders("live-access-token")).toEqual({
      Authorization: "Bearer live-access-token",
    });
  });
});

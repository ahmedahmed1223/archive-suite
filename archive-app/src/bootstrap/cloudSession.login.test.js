import { describe, expect, it } from "vitest";

import { loginToCloud } from "./cloudSession.js";

describe("loginToCloud API diagnostics", () => {
  it("explains when the frontend serves HTML instead of the auth API", async () => {
    const fetchImpl = async () => new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });

    await expect(loginToCloud({
      username: "admin",
      password: "secret",
      fetchImpl
    })).rejects.toThrow(/API|الخادم|proxy/i);
  });
});

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

function forwardedLocale(response: Response): string | null {
  return response.headers.get("x-middleware-request-x-archive-locale");
}

describe("locale request forwarding", () => {
  it("forwards the supported locale cookie ahead of the browser language", () => {
    const request = new NextRequest("http://localhost/login", {
      headers: {
        "accept-language": "ar-SA,ar;q=0.9",
        cookie: "archive_locale=en",
      },
    });

    const response = proxy(request);

    expect(forwardedLocale(response)).toBe("en");
    expect(response.headers.get("x-middleware-request-x-archive-locale-cookie")).toBe("1");
  });

  it("forwards the supported browser language when no locale cookie exists", () => {
    const request = new NextRequest("http://localhost/login", {
      headers: { "accept-language": "en-US,en;q=0.9" },
    });

    const response = proxy(request);

    expect(forwardedLocale(response)).toBe("en");
    expect(response.headers.get("x-middleware-request-x-archive-locale-cookie")).toBe("0");
  });
});

import { describe, expect, it } from "vitest";
import { forwardArchiveApiResponse } from "./archive-api-proxy";

describe("forwardArchiveApiResponse", () => {
  it("preserves each Set-Cookie header independently", () => {
    const upstream = new Response("{}", {
      status: 200,
      headers: [
        ["Set-Cookie", "va_refresh=refresh-token; Path=/api/v1/auth/refresh; HttpOnly"],
        ["Set-Cookie", "va_session=1; Path=/; HttpOnly"],
      ],
    });

    const response = forwardArchiveApiResponse(upstream);
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };

    expect(headers.getSetCookie?.()).toEqual([
      "va_refresh=refresh-token; Path=/api/v1/auth/refresh; HttpOnly",
      "va_session=1; Path=/; HttpOnly",
    ]);
  });
});

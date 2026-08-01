import { NextResponse } from "next/server";

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Rebuild an upstream API response without collapsing multiple Set-Cookie
 * headers into a comma-separated value, which browsers cannot parse safely.
 */
type CookieOptions = { path?: string; domain?: string; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: "strict" | "lax" | "none"; maxAge?: number };

/**
 * Some fetch implementations expose multiple Set-Cookie values as one comma
 * joined header. Split only at the start of the next cookie so commas inside
 * an Expires attribute remain intact.
 */
function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;,\s]+=)/).map((cookie) => cookie.trim()).filter(Boolean);
}

function setCookie(response: NextResponse, value: string) {
  const [pair, ...attributes] = value.split(";");
  const separator = pair.indexOf("=");
  if (separator < 1) return;

  const options: CookieOptions = {};
  for (const attribute of attributes) {
    const [rawName, ...rawValue] = attribute.trim().split("=");
    const name = rawName.toLowerCase();
    const attributeValue = rawValue.join("=");
    if (name === "path") options.path = attributeValue;
    else if (name === "domain") options.domain = attributeValue;
    else if (name === "httponly") options.httpOnly = true;
    else if (name === "secure") options.secure = true;
    else if (name === "samesite" && ["strict", "lax", "none"].includes(attributeValue.toLowerCase())) options.sameSite = attributeValue.toLowerCase() as CookieOptions["sameSite"];
    else if (name === "max-age" && Number.isFinite(Number(attributeValue))) options.maxAge = Number(attributeValue);
    else if (name === "expires" && !Number.isNaN(Date.parse(attributeValue))) options.expires = new Date(attributeValue);
  }

  response.cookies.set({ name: pair.slice(0, separator), value: pair.slice(separator + 1), ...options });
}

export function forwardArchiveApiResponse(upstream: Response): NextResponse {
  const headers = new Headers();

  upstream.headers.forEach((value, name) => {
    if (name !== "set-cookie" && !HOP_BY_HOP_RESPONSE_HEADERS.has(name)) {
      headers.set(name, value);
    }
  });

  const response = new NextResponse(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const headerCookies = upstreamHeaders.getSetCookie?.() ?? [];
  const cookies = headerCookies.length > 0 ? headerCookies : [upstream.headers.get("set-cookie") ?? ""];
  for (const cookie of cookies.flatMap(splitSetCookieHeader)) setCookie(response, cookie);

  return response;
}

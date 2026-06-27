import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRateLimiter, clientIp } from "../rateLimit.js";

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.check("test-key")).toBe(true);
    expect(limiter.check("test-key")).toBe(true);
    expect(limiter.check("test-key")).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
    limiter.check("k");
    limiter.check("k");
    expect(limiter.check("k")).toBe(false);
  });

  it("further requests after exceeding limit are also blocked", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    limiter.check("x");
    expect(limiter.check("x")).toBe(false);
    expect(limiter.check("x")).toBe(false);
  });

  it("does not share limits between different keys", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    limiter.check("a");
    // "a" is now at limit, but "b" has its own fresh counter
    expect(limiter.check("b")).toBe(true);
  });

  it("allows max=1 for a single request", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check("single")).toBe(true);
    expect(limiter.check("single")).toBe(false);
  });

  it("exposes _store as a Map", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
    expect(limiter._store).toBeInstanceOf(Map);
  });

  it("uses default options when none provided", () => {
    const limiter = createRateLimiter();
    expect(limiter.check("default-key")).toBe(true);
  });
});

describe("clientIp", () => {
  const originalEnv = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalEnv;
    }
  });

  it("uses X-Real-IP when TRUST_PROXY is '1'", () => {
    process.env.TRUST_PROXY = "1";
    const req = { headers: { "x-real-ip": "1.2.3.4" }, socket: { remoteAddress: "5.6.7.8" } };
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("uses X-Forwarded-For first entry when X-Real-IP is absent and TRUST_PROXY='1'", () => {
    process.env.TRUST_PROXY = "1";
    const req = { headers: { "x-forwarded-for": "9.8.7.6, 1.1.1.1" }, socket: { remoteAddress: "5.6.7.8" } };
    expect(clientIp(req)).toBe("9.8.7.6");
  });

  it("uses socket remoteAddress when TRUST_PROXY is '0'", () => {
    process.env.TRUST_PROXY = "0";
    const req = { headers: { "x-real-ip": "1.2.3.4" }, socket: { remoteAddress: "5.6.7.8" } };
    expect(clientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when socket has no remoteAddress and TRUST_PROXY='0'", () => {
    process.env.TRUST_PROXY = "0";
    const req = { headers: {}, socket: {} };
    expect(clientIp(req)).toBe("unknown");
  });

  it("trims whitespace from X-Real-IP", () => {
    process.env.TRUST_PROXY = "1";
    const req = { headers: { "x-real-ip": "  1.2.3.4  " }, socket: {} };
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("uses socket address when X-Real-IP is empty string and TRUST_PROXY='1'", () => {
    process.env.TRUST_PROXY = "1";
    // Empty x-real-ip falls through to XFF, then socket
    const req = { headers: { "x-real-ip": "" }, socket: { remoteAddress: "10.0.0.1" } };
    // No XFF either, so falls through to socket
    expect(clientIp(req)).toBe("10.0.0.1");
  });
});

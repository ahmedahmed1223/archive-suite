import { describe, expect, test } from "vitest";
import { fetchControlLogs, fetchControlStatus, SystemControlError } from "./systemControlClient.js";

describe("systemControlClient", () => {
  test("fetchControlStatus sends bearer auth and unwraps result", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push([url, init]);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            result: {
              ok: true,
              readOnly: true,
              metrics: { cpu: { percent: 12 } },
              services: [{ id: "api", status: "running" }]
            }
          };
        }
      };
    };

    const result = await fetchControlStatus({
      baseUrl: "https://archive.example/",
      token: "jwt-token",
      fetchImpl,
      checkedAt: "2026-06-18T00:00:00.000Z"
    });

    expect(calls[0][0]).toBe("https://archive.example/api/control/status");
    expect(calls[0][1].headers.Authorization).toBe("Bearer jwt-token");
    expect(result.checkedAt).toBe("2026-06-18T00:00:00.000Z");
    expect(result.metrics.cpu.percent).toBe(12);
    expect(result.services[0].id).toBe("api");
  });

  test("fetchControlLogs encodes service and limit", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push([url, init]);
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, result: { lines: [{ line: "started" }] } };
        }
      };
    };

    const result = await fetchControlLogs({
      service: "archive api",
      limit: 5,
      token: "jwt-token",
      fetchImpl
    });

    expect(calls[0][0]).toBe("/api/control/logs?service=archive+api&limit=5");
    expect(calls[0][1].headers.Authorization).toBe("Bearer jwt-token");
    expect(result.lines[0].line).toBe("started");
  });

  test("throws SystemControlError on HTTP failure", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 403,
      async json() {
        return { ok: false, error: "Admin privileges required." };
      }
    });

    await expect(fetchControlStatus({ fetchImpl })).rejects.toMatchObject({
      name: "SystemControlError",
      status: 403,
      message: "Admin privileges required."
    });
    expect(SystemControlError).toBeTypeOf("function");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchRpc, RPC_METHODS } from "../rpcHandler.js";

// ---------------------------------------------------------------------------
// Mock provider factory
// ---------------------------------------------------------------------------
function createMockProvider() {
  const store = new Map();

  return {
    open: vi.fn().mockResolvedValue(undefined),

    get: vi.fn().mockImplementation(async (s, key) =>
      store.get(`${s}:${key}`) ?? null
    ),

    getAll: vi.fn().mockImplementation(async (s) =>
      [...store.values()].filter((r) => r.__store === s)
    ),

    put: vi.fn().mockImplementation(async (s, record) => {
      const uid = record.uid || record.id || `uid_${Date.now()}`;
      const saved = { ...record, uid, __store: s };
      store.set(`${s}:${uid}`, saved);
      return saved;
    }),

    add: vi.fn().mockImplementation(async (s, record) => {
      const uid = record.uid || `uid_${Date.now()}`;
      const saved = { ...record, uid, __store: s };
      store.set(`${s}:${uid}`, saved);
      return saved;
    }),

    delete: vi.fn().mockImplementation(async (s, key) => {
      store.delete(`${s}:${key}`);
    }),

    clear: vi.fn().mockImplementation(async (s) => {
      for (const k of [...store.keys()]) {
        if (k.startsWith(`${s}:`)) store.delete(k);
      }
    }),

    putBatch: vi.fn().mockResolvedValue(undefined),

    deleteBatch: vi.fn().mockResolvedValue(undefined),

    snapshot: vi.fn().mockResolvedValue({
      exportedAt: new Date().toISOString(),
      stores: {},
    }),

    replaceAll: vi.fn().mockResolvedValue({ written: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dispatch(request, provider) {
  return dispatchRpc(request, { resolveProvider: () => provider });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("RPC_METHODS constant", () => {
  it("exports an array of allowed method names", () => {
    expect(Array.isArray(RPC_METHODS)).toBe(true);
    expect(RPC_METHODS.length).toBeGreaterThan(0);
  });

  it("includes every expected port method", () => {
    const expected = [
      "open", "get", "getAll", "put", "add", "delete",
      "clear", "putBatch", "deleteBatch", "snapshot", "replaceAll",
    ];
    for (const m of expected) {
      expect(RPC_METHODS).toContain(m);
    }
  });
});

describe("dispatchRpc — open", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.open with no args", async () => {
    await dispatch({ method: "open", args: [] }, provider);
    expect(provider.open).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchRpc — getAll", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("returns an array", async () => {
    const result = await dispatch({ method: "getAll", args: ["users"] }, provider);
    expect(Array.isArray(result)).toBe(true);
  });

  it("passes store name to provider", async () => {
    await dispatch({ method: "getAll", args: ["users"] }, provider);
    expect(provider.getAll).toHaveBeenCalledWith("users");
  });

  it("passes optional pagination opts to provider", async () => {
    const opts = { cursor: "abc", limit: 10 };
    await dispatch({ method: "getAll", args: ["users", opts] }, provider);
    expect(provider.getAll).toHaveBeenCalledWith("users", opts);
  });
});

describe("dispatchRpc — get", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.get with store and key", async () => {
    await dispatch({ method: "get", args: ["users", "u1"] }, provider);
    expect(provider.get).toHaveBeenCalledWith("users", "u1");
  });

  it("returns null when key is absent", async () => {
    const result = await dispatch({ method: "get", args: ["users", "missing"] }, provider);
    expect(result).toBeNull();
  });
});

describe("dispatchRpc — put", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("passes store and record to provider.put", async () => {
    const record = { uid: "test-1", name: "اختبار" };
    await dispatch({ method: "put", args: ["items", record] }, provider);
    expect(provider.put).toHaveBeenCalledWith("items", record);
  });

  it("returns the saved record", async () => {
    const record = { uid: "p1", value: 42 };
    const result = await dispatch({ method: "put", args: ["items", record] }, provider);
    expect(result).toMatchObject({ uid: "p1", value: 42 });
  });
});

describe("dispatchRpc — add", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("passes store and record to provider.add", async () => {
    const record = { name: "new item" };
    await dispatch({ method: "add", args: ["items", record] }, provider);
    expect(provider.add).toHaveBeenCalledWith("items", record);
  });

  it("returns the saved record", async () => {
    const record = { uid: "a1", tag: "test" };
    const result = await dispatch({ method: "add", args: ["items", record] }, provider);
    expect(result).toMatchObject({ uid: "a1", tag: "test" });
  });
});

describe("dispatchRpc — delete", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.delete with store and key", async () => {
    await dispatch({ method: "delete", args: ["users", "uid-1"] }, provider);
    expect(provider.delete).toHaveBeenCalledWith("users", "uid-1");
  });
});

describe("dispatchRpc — clear", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.clear with the store name", async () => {
    await dispatch({ method: "clear", args: ["sessions"] }, provider);
    expect(provider.clear).toHaveBeenCalledWith("sessions");
  });
});

describe("dispatchRpc — putBatch", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.putBatch with store and items array", async () => {
    const items = [{ uid: "b1" }, { uid: "b2" }];
    await dispatch({ method: "putBatch", args: ["items", items] }, provider);
    expect(provider.putBatch).toHaveBeenCalledWith("items", items);
  });
});

describe("dispatchRpc — deleteBatch", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.deleteBatch with store and keys array", async () => {
    const keys = ["k1", "k2"];
    await dispatch({ method: "deleteBatch", args: ["items", keys] }, provider);
    expect(provider.deleteBatch).toHaveBeenCalledWith("items", keys);
  });
});

describe("dispatchRpc — snapshot", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("returns an object with exportedAt", async () => {
    const result = await dispatch({ method: "snapshot", args: [] }, provider);
    expect(result).toHaveProperty("exportedAt");
    expect(typeof result.exportedAt).toBe("string");
  });

  it("calls provider.snapshot", async () => {
    await dispatch({ method: "snapshot", args: [] }, provider);
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
  });

  it("passes optional snapshot opts to provider", async () => {
    const opts = { store: "items", cursor: "abc", limit: 50 };
    await dispatch({ method: "snapshot", args: [opts] }, provider);
    expect(provider.snapshot).toHaveBeenCalledWith(opts);
  });
});

describe("dispatchRpc — replaceAll", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("calls provider.replaceAll with the payload", async () => {
    const payload = { stores: { items: [] } };
    await dispatch({ method: "replaceAll", args: [payload] }, provider);
    expect(provider.replaceAll).toHaveBeenCalledWith(payload);
  });

  it("returns an object with a written count", async () => {
    const result = await dispatch(
      { method: "replaceAll", args: [{ stores: {} }] },
      provider
    );
    expect(result).toHaveProperty("written");
  });
});

describe("dispatchRpc — error cases", () => {
  let provider;
  beforeEach(() => { provider = createMockProvider(); });

  it("rejects unknown methods with statusCode 400", async () => {
    await expect(
      dispatch({ method: "hackerMethod", args: [] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when method is missing entirely", async () => {
    await expect(
      dispatch({ args: [] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects null method with statusCode 400", async () => {
    await expect(
      dispatch({ method: null, args: [] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects invalid store name (number) for getAll with statusCode 400", async () => {
    await expect(
      dispatch({ method: "getAll", args: [123] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects invalid store name (empty string) for put with statusCode 400", async () => {
    await expect(
      dispatch({ method: "put", args: ["", { uid: "1" }] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects non-object record for put with statusCode 400", async () => {
    await expect(
      dispatch({ method: "put", args: ["items", "not-an-object"] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects missing key for delete with statusCode 400", async () => {
    await expect(
      dispatch({ method: "delete", args: ["items"] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects non-array items for putBatch with statusCode 400", async () => {
    await expect(
      dispatch({ method: "putBatch", args: ["items", "not-an-array"] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects non-array keys for deleteBatch with statusCode 400", async () => {
    await expect(
      dispatch({ method: "deleteBatch", args: ["items", null] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects non-object payload for replaceAll with statusCode 400", async () => {
    await expect(
      dispatch({ method: "replaceAll", args: ["not-an-object"] }, provider)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 500 when provider does not implement the method", async () => {
    const partial = {};
    await expect(
      dispatchRpc({ method: "getAll", args: ["items"] }, { resolveProvider: () => partial })
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("dispatchRpc — put + get round-trip", () => {
  it("stores and retrieves a record via the mock", async () => {
    const provider = createMockProvider();
    const record = { uid: "rt-1", label: "round-trip" };

    await dispatch({ method: "put", args: ["things", record] }, provider);
    const fetched = await dispatch({ method: "get", args: ["things", "rt-1"] }, provider);

    expect(fetched).toMatchObject({ uid: "rt-1", label: "round-trip" });
  });
});

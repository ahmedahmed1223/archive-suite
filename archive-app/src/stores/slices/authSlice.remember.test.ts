/**
 * @vitest-environment jsdom
 *
 * Regression tests for the "remember login session" checkbox. The bugs being
 * pinned down:
 *   1. Local backend wrote SESSION_KEY *after* an awaited IndexedDB write, so
 *      any dbPut failure killed remember-me silently.
 *   2. Cloud backend unconditionally cleared SESSION_KEY and initAuth had no
 *      branch to restore a cloud session, so cloud users were always logged
 *      out on reload regardless of the checkbox.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "va_session";
type TestUser = {
  id: string;
  username: string;
  passwordHash?: string;
  isActive?: boolean;
  [key: string]: any;
};

const mockState = {
  users: [] as TestUser[],
  updateUserCalls: [] as TestUser[],
  updateUserShouldThrow: false,
  cloudUser: null as null | Record<string, any>,
  cloudToken: ""
};

vi.mock("@archive/core", () => ({
  getSessionProvider: () => ({
    signIn: vi.fn(async ({ username }) => ({ token: "cloud-bearer", user: { id: username, username } })),
    signOut: vi.fn(async () => true),
    getCurrentUser: () => mockState.cloudUser,
    getToken: () => mockState.cloudToken,
    onChange: () => () => {}
  })
}));

vi.mock("../../utils/passwordHash.js", () => ({
  hashPassword: vi.fn(async (p: string) => `bcrypt$${p}`),
  isLegacyHash: () => false,
  validatePasswordStrength: () => [],
  verifyPassword: vi.fn(async (input: string, hash: string) => hash === `bcrypt$${input}`)
}));

vi.mock("../../features/users/permissions.js", () => ({
  canPerform: () => true
}));

vi.mock("../../bootstrap/backendChoice.js", () => ({
  resolveBackendChoice: vi.fn(() => ({ backend: "local", url: "" }))
}));

vi.mock("../storeCore.js", () => ({
  generateId: (prefix: string) => `${prefix}_test`,
  nowIso: () => "2026-06-22T00:00:00.000Z"
}));

import { resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { createAuthStore } from "./authSlice.js";
const resolveBackendChoiceMock = vi.mocked(resolveBackendChoice) as any;

function makeStore() {
  const fakeStore = (initializer: any) => {
    let state: any = {};
    const set = (patch: any) => {
      state = typeof patch === "function"
        ? { ...state, ...patch(state) }
        : { ...state, ...patch };
    };
    const get = () => state;
    const api = initializer(set, get);
    state = { ...state, ...api };
    return {
      getState: () => state,
      setState: (patch: any) => set(patch)
    };
  };
  const appState = {
    users: mockState.users,
    currentUser: null as null | TestUser,
    updateUser: async (user: TestUser) => {
      mockState.updateUserCalls.push(user);
      if (mockState.updateUserShouldThrow) throw new Error("db write failed");
      appState.users = appState.users.map((item: TestUser) => item.id === user.id ? user : item);
      return user;
    }
  };
  const useAppStore = {
    getState: () => appState,
    setState: (patch: any) => Object.assign(appState, typeof patch === "function" ? patch(appState) : patch)
  };
  return createAuthStore({ createStore: fakeStore, useAppStore });
}

beforeEach(() => {
  localStorage.clear();
  mockState.users = [
    { id: "u_admin", username: "admin", passwordHash: "bcrypt$pw", isActive: true }
  ];
  mockState.updateUserCalls = [];
  mockState.updateUserShouldThrow = false;
  mockState.cloudUser = null;
  mockState.cloudToken = "";
  resolveBackendChoiceMock.mockReturnValue({ backend: "local", url: "" });
});

describe("local backend — remember me", () => {
  it("persists SESSION_KEY when rememberMe is true", async () => {
    const store = makeStore();
    const ok = await store.getState().login("admin", "pw", true);
    expect(ok).toBe(true);
    const raw = localStorage.getItem(SESSION_KEY);
    expect(raw).toBeTruthy();
    expect(raw?.split(":")).toHaveLength(3);
  });

  it("clears SESSION_KEY when rememberMe is false", async () => {
    localStorage.setItem(SESSION_KEY, "stale:x:0");
    const store = makeStore();
    const ok = await store.getState().login("admin", "pw", false);
    expect(ok).toBe(true);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("still writes SESSION_KEY when updateUser throws (regression)", async () => {
    mockState.updateUserShouldThrow = true;
    const store = makeStore();
    const ok = await store.getState().login("admin", "pw", true);
    expect(ok).toBe(true);
    // The fix moves the localStorage write BEFORE the updateUser call.
    expect(localStorage.getItem(SESSION_KEY)).toBeTruthy();
  });
});

describe("cloud backend — remember me", () => {
  beforeEach(() => {
    resolveBackendChoiceMock.mockReturnValue({ backend: "postgres", url: "https://api.example" });
  });

  it("writes a cloud marker when rememberMe is true (regression)", async () => {
    const store = makeStore();
    const ok = await store.getState().login("admin", "pw", true);
    expect(ok).toBe(true);
    const raw = localStorage.getItem(SESSION_KEY);
    expect(raw).toBeTruthy();
    expect(raw?.split(":")[0]).toBe("cloud");
  });

  it("clears SESSION_KEY when rememberMe is false", async () => {
    localStorage.setItem(SESSION_KEY, "stale:x:0");
    const store = makeStore();
    const ok = await store.getState().login("admin", "pw", false);
    expect(ok).toBe(true);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe("initAuth — cloud restore", () => {
  it("restores a cloud session from the marker via SessionProvider", async () => {
    mockState.cloudUser = { id: "u_cloud", username: "alice" };
    mockState.cloudToken = "cloud-bearer";
    const future = Date.now() + 60_000;
    localStorage.setItem(SESSION_KEY, `cloud:u_cloud:${future}`);
    const store = makeStore();
    const ok = await store.getState().initAuth();
    expect(ok).toBe(true);
    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().currentUser?.username).toBe("alice");
  });

  it("clears the marker and returns false when the provider has no live user", async () => {
    mockState.cloudUser = null;
    mockState.cloudToken = "";
    const future = Date.now() + 60_000;
    localStorage.setItem(SESSION_KEY, `cloud:u_cloud:${future}`);
    const store = makeStore();
    const ok = await store.getState().initAuth();
    expect(ok).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { createFirebaseSessionProvider } from "./firebaseSession.js";

const CONFIG = { apiKey: "k", projectId: "archive-test", appId: "app" };

type FakeUser = {
  uid: string;
  email: string;
  displayName: string;
  getIdToken: () => Promise<string>;
};

function createFakeAuth() {
  const listeners = new Set<(user: FakeUser | null) => void>();
  let user: FakeUser | null = null;
  const auth = { tag: "auth" };
  const authModule = {
    getAuth: () => auth,
    signInWithEmailAndPassword: async (_auth: unknown, email: string) => {
      user = {
        uid: "u1",
        email,
        displayName: "Editor",
        getIdToken: async () => "firebase-token"
      };
      for (const listener of listeners) listener(user);
      return { user };
    },
    signOut: async () => {
      user = null;
      for (const listener of listeners) listener(null);
    },
    onAuthStateChanged: (_auth: unknown, listener: (user: FakeUser | null) => void) => {
      listeners.add(listener);
      listener(user);
      return () => listeners.delete(listener);
    }
  };
  return { authModule };
}

describe("createFirebaseSessionProvider", () => {
  it("signs in with Firebase Auth and exposes current user/token", async () => {
    const { authModule } = createFakeAuth();
    const provider = createFirebaseSessionProvider({
      firebaseConfig: CONFIG,
      firebaseAppModule: { initializeApp: () => ({}) },
      firebaseAuthModule: authModule
    });

    const seen: Array<string | null> = [];
    const unsubscribe = provider.onChange((user) => seen.push(user?.email || null));
    const result = await provider.signIn({ username: "editor@example.com", password: "pw" });

    expect(result.user).toMatchObject({ id: "u1", username: "editor@example.com", role: "editor" });
    expect(await provider.getToken()).toBe("firebase-token");
    expect(provider.getCurrentUser()?.username).toBe("editor@example.com");
    expect(seen).toEqual([null, "editor@example.com"]);

    unsubscribe();
    await provider.signOut();
    expect(provider.getCurrentUser()).toBeNull();
  });
});

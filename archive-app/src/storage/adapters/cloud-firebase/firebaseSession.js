import { isFirebaseConfigValid } from "./index.js";

function normalizeFirebaseUser(user) {
  if (!user) return null;
  const email = user.email || user.displayName || user.uid || "firebase-user";
  return {
    id: user.uid || email,
    username: email,
    email: user.email || "",
    name: user.displayName || email,
    role: "editor",
    provider: "firebase"
  };
}

export function createFirebaseSessionProvider({
  firebaseConfig,
  firebaseAppModule,
  firebaseAuthModule
} = {}) {
  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("Firebase config requires apiKey, projectId, and appId.");
  }

  let authPromise = null;
  let currentUser = null;
  let currentRawUser = null;
  let currentToken = "";
  const listeners = new Set();

  function emitUser(user) {
    const next = normalizeFirebaseUser(user);
    const prevKey = currentUser ? `${currentUser.id}:${currentUser.username}` : "";
    const nextKey = next ? `${next.id}:${next.username}` : "";
    currentRawUser = user || null;
    currentUser = next;
    if (!user) currentToken = "";
    if (user && typeof user.getIdToken === "function") {
      user.getIdToken().then((token) => {
        currentToken = String(token || "");
      }).catch(() => undefined);
    }
    if (prevKey === nextKey) return;
    for (const listener of listeners) listener(currentUser);
  }

  async function loadAuth() {
    if (!authPromise) {
      authPromise = (async () => {
        const appModule = firebaseAppModule || (await import("firebase/app"));
        const authModule = firebaseAuthModule || (await import("firebase/auth"));
        const app = appModule.initializeApp(firebaseConfig);
        const auth = authModule.getAuth(app);
        if (typeof authModule.onAuthStateChanged === "function") {
          authModule.onAuthStateChanged(auth, emitUser);
        }
        return { auth, authModule };
      })();
    }
    return authPromise;
  }

  return {
    async signIn({ username, password } = {}) {
      const { auth, authModule } = await loadAuth();
      const result = await authModule.signInWithEmailAndPassword(auth, String(username || ""), String(password || ""));
      if (result?.user && typeof result.user.getIdToken === "function") {
        currentToken = String(await result.user.getIdToken() || "");
      }
      emitUser(result?.user || null);
      return { token: currentToken, user: currentUser };
    },
    async signOut() {
      const { auth, authModule } = await loadAuth();
      await authModule.signOut(auth);
      emitUser(null);
      return true;
    },
    getCurrentUser() {
      return currentUser;
    },
    getToken() {
      return currentToken;
    },
    onChange(handler) {
      if (typeof handler !== "function") return () => {};
      listeners.add(handler);
      handler(currentUser);
      loadAuth().catch(() => undefined);
      return () => listeners.delete(handler);
    }
  };
}

import { isFirebaseConfigValid } from "./index.js";

type FirebaseConfig = Record<string, string>;

type FirebaseUser = {
  uid?: string;
  email?: string;
  displayName?: string;
  getIdToken?: () => Promise<unknown>;
};

type FirebaseAppModule = {
  initializeApp(config: FirebaseConfig): unknown;
};

type FirebaseAuthModule = {
  getAuth(app: unknown): unknown;
  signInWithEmailAndPassword(auth: unknown, email: string, password: string): Promise<{ user?: FirebaseUser | null }>;
  signOut(auth: unknown): Promise<void>;
  onAuthStateChanged?: (auth: unknown, listener: (user: FirebaseUser | null) => void) => unknown;
};

type FirebaseSessionOptions = {
  firebaseConfig?: FirebaseConfig | null;
  firebaseAppModule?: FirebaseAppModule;
  firebaseAuthModule?: FirebaseAuthModule;
};

type SessionUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: "editor";
  provider: "firebase";
};

function normalizeFirebaseUser(user: FirebaseUser | null | undefined): SessionUser | null {
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
}: FirebaseSessionOptions = {}) {
  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("Firebase config requires apiKey, projectId, and appId.");
  }

  let authPromise: Promise<{ auth: unknown; authModule: FirebaseAuthModule }> | null = null;
  let currentUser: SessionUser | null = null;
  let currentRawUser: FirebaseUser | null = null;
  let currentToken = "";
  const listeners = new Set<(user: SessionUser | null) => void>();

  function emitUser(user: FirebaseUser | null | undefined) {
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
        const appModule = (firebaseAppModule || (await import("firebase/app"))) as FirebaseAppModule;
        const authModule = (firebaseAuthModule || (await import("firebase/auth"))) as unknown as FirebaseAuthModule;
        const app = appModule.initializeApp(firebaseConfig as FirebaseConfig);
        const auth = authModule.getAuth(app as never);
        if (typeof authModule.onAuthStateChanged === "function") {
          authModule.onAuthStateChanged(auth, emitUser);
        }
        return { auth, authModule };
      })();
    }
    return authPromise!;
  }

  return {
    async signIn({ username, password }: { username?: unknown; password?: unknown } = {}) {
      const { auth, authModule } = await loadAuth();
      const result = await authModule.signInWithEmailAndPassword(auth, String(username || ""), String(password || ""));
      if (result?.user && typeof result.user.getIdToken === "function") {
        currentToken = String((await result.user.getIdToken()) || "");
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
    onChange(handler: (user: SessionUser | null) => void) {
      if (typeof handler !== "function") return () => {};
      listeners.add(handler);
      handler(currentUser);
      loadAuth().catch(() => undefined);
      return () => listeners.delete(handler);
    }
  };
}

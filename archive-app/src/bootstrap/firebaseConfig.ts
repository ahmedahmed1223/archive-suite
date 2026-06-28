const FIREBASE_CLIENT_KEYS = Object.freeze([
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
  "measurementId"
] as const);

const REQUIRED_KEYS = Object.freeze(["apiKey", "projectId", "appId"] as const);

export interface FirebaseConfigResult {
  ok: boolean;
  config: Record<string, string>;
  errors: string[];
}

function sanitizeText(value: unknown): string {
  return String(value || "").trim();
}

export function sanitizeFirebaseConfig(value: unknown): FirebaseConfigResult {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const config: Record<string, string> = {};
  for (const key of FIREBASE_CLIENT_KEYS) {
    const text = sanitizeText(source[key]);
    if (text) config[key] = text;
  }
  const errors = REQUIRED_KEYS.filter((key) => !config[key]);
  return { ok: errors.length === 0, config, errors: [...errors] };
}

export function parseFirebaseConfigText(text: unknown): FirebaseConfigResult {
  try {
    const parsed = JSON.parse(String(text || "").trim() || "{}");
    return sanitizeFirebaseConfig(parsed);
  } catch {
    return { ok: false, config: {}, errors: ["invalid_json"] };
  }
}

export function stringifyFirebaseConfig(config: unknown): string {
  const sanitized = sanitizeFirebaseConfig(config);
  return JSON.stringify(sanitized.config, null, 2);
}

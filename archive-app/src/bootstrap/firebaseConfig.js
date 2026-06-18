const FIREBASE_CLIENT_KEYS = Object.freeze([
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
  "measurementId"
]);

const REQUIRED_KEYS = Object.freeze(["apiKey", "projectId", "appId"]);

export function sanitizeFirebaseConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const config = {};
  for (const key of FIREBASE_CLIENT_KEYS) {
    const text = String(source[key] || "").trim();
    if (text) config[key] = text;
  }
  const errors = REQUIRED_KEYS.filter((key) => !config[key]);
  return { ok: errors.length === 0, config, errors };
}

export function parseFirebaseConfigText(text) {
  try {
    const parsed = JSON.parse(String(text || "").trim() || "{}");
    return sanitizeFirebaseConfig(parsed);
  } catch {
    return { ok: false, config: {}, errors: ["invalid_json"] };
  }
}

export function stringifyFirebaseConfig(config) {
  const sanitized = sanitizeFirebaseConfig(config);
  return JSON.stringify(sanitized.config, null, 2);
}

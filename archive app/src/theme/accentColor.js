export const ACCENT_COLOR_TOKENS = {
  teal: { accent: "#0d9488", strong: "#0f766e", soft: "#0f3f3b" },
  indigo: { accent: "#5b5fc7", strong: "#4338ca", soft: "#27275f" },
  emerald: { accent: "#059669", strong: "#047857", soft: "#063b32" },
  blue: { accent: "#2563eb", strong: "#1d4ed8", soft: "#172554" },
  slate: { accent: "#475569", strong: "#334155", soft: "#1e293b" },
  purple: { accent: "#7c3aed", strong: "#6d28d9", soft: "#2e1065" },
  amber: { accent: "#b45309", strong: "#92400e", soft: "#451a03" },
  rose: { accent: "#e11d48", strong: "#be123c", soft: "#4c0519" }
};

export function getAccentColorTokens(accentColor = "blue") {
  return ACCENT_COLOR_TOKENS[accentColor] || ACCENT_COLOR_TOKENS.blue;
}

export function applyAccentColor(accentColor = "teal", root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return getAccentColorTokens(accentColor);

  const tokens = getAccentColorTokens(accentColor);
  root.style.setProperty("--app-accent", tokens.accent);
  root.style.setProperty("--color-accent", tokens.accent);
  root.style.setProperty("--va-v1-accent", tokens.accent);
  root.style.setProperty("--va-v1-accent-strong", tokens.strong);
  root.style.setProperty("--va-v1-accent-soft", tokens.soft);
  return tokens;
}

function error(code, message) {
  return { code, message };
}

function normalizeToken(value) {
  return String(value).trim().toLowerCase();
}

function splitTokens(input) {
  return String(input)
    .split(/[,+;|]/)
    .map(normalizeToken)
    .filter(Boolean);
}

function safeUnknownToken() {
  // Interactive errors are displayed before the Setup-wide result redactor
  // runs. Do not echo arbitrary input here: a pasted URL can contain a user,
  // password, token, or internal hostname.
  return "[REDACTED_INPUT]";
}

// This parser deliberately recognizes only declared names, numbers, and
// aliases. Similar-looking input is rejected instead of guessed so a wizard
// choice cannot unexpectedly expose a service or consume extra resources.
export function parseWizardChoices(input, { options, aliases = {}, allowAll = false, allowNone = false }) {
  const canonicalOptions = options.map((option) => typeof option === "string" ? option : option.id);
  const lookup = new Map(canonicalOptions.map((option) => [normalizeToken(option), option]));
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (canonicalOptions.includes(canonical)) lookup.set(normalizeToken(alias), canonical);
  }

  const tokens = splitTokens(input);
  if (!tokens.length) return error("CHOICE_REQUIRED", "Enter one or more choices, or type none.");
  const specialTokens = tokens.filter((token) => token === "all" || token === "none");
  if (specialTokens.length) {
    if (tokens.length !== 1) return error("CHOICE_SPECIAL_TOKEN_MIXED", "Use all or none by itself, not together with other choices.");
    if (tokens[0] === "all") return allowAll ? [...canonicalOptions] : error("CHOICE_ALL_UNAVAILABLE", "all is not available for this question.");
    return allowNone ? [] : error("CHOICE_NONE_UNAVAILABLE", "none is not available for this question.");
  }

  const selected = new Set();
  for (const token of tokens) {
    const numericIndex = /^\d+$/.test(token) ? Number(token) - 1 : null;
    const canonical = numericIndex === null ? lookup.get(token) : canonicalOptions[numericIndex];
    if (!canonical) return error("CHOICE_UNKNOWN", `Unknown choice ${safeUnknownToken()}. Use one of: ${canonicalOptions.join(", ")}.`);
    selected.add(canonical);
  }
  return canonicalOptions.filter((option) => selected.has(option));
}

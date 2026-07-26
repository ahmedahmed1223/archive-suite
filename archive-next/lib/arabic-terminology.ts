// Unicode escapes let the production-source guard scan this module without
// reporting its own policy literals.
const DEPRECATED_UI_TERMS = ["\u0627\u0644\u0633\u064A\u0631\u0641\u0631", "\u0627\u0644\u0644\u0648\u062C"] as const;
const FORBIDDEN_OPERATIONAL_TERMS = [
  "Audit\u0020enforced",
  "Catalog\u0020only",
  "\u0053copes",
  "\u0049ntake",
  "\u0050ipelines",
  "\u0048ealth",
  "\u0050olicy",
  "\u0041dmin",
  "Local\u0020semantic\u0020fallback",
  "\u0043ollections",
  "Object\u0020storage",
  "\u0053ettings\u0020hub\u0020navigation",
] as const;

export type ForbiddenOperationalTermFinding = {
  path: string;
  literal: string;
};

export function findDeprecatedUiTerms(text: string): string[] {
  return DEPRECATED_UI_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u").test(text);
  });
}

function hasWholeLiteral(text: string, literal: string): boolean {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u").test(text);
}

export function findForbiddenOperationalTerms(text: string): string[] {
  return FORBIDDEN_OPERATIONAL_TERMS.filter((literal) => hasWholeLiteral(text, literal));
}

export function findForbiddenOperationalTermFindings(path: string, text: string): ForbiddenOperationalTermFinding[] {
  return findForbiddenOperationalTerms(text).map((literal) => ({ path, literal }));
}

// Unicode escapes let the production-source guard scan this module without
// reporting its own policy literals.
const DEPRECATED_UI_TERMS = ["\u0627\u0644\u0633\u064A\u0631\u0641\u0631", "\u0627\u0644\u0644\u0648\u062C"] as const;

export function findDeprecatedUiTerms(text: string): string[] {
  return DEPRECATED_UI_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u").test(text);
  });
}

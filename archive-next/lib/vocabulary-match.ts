import type { VocabularyTerm } from "@/lib/archive-api";

export interface VocabularyMatch {
  termId: string;
  term: string;
  kind: string;
  note: string | null;
  matchedText: string;
  start: number;
  end: number;
}

export interface VocabularyMatcher {
  findMatches(text: string): VocabularyMatch[];
}

const EMPTY_MATCHER: VocabularyMatcher = { findMatches: () => [] };

export function splitAliases(aliases: string | null | undefined): string[] {
  if (!aliases) return [];
  return aliases
    .split(/[,;،]/u)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/**
 * Builds a reusable matcher over a vocabulary snapshot. One compiled regex
 * alternation (candidate strings sorted longest-first) drives a single
 * left-to-right pass per lookup, so a compound term like "قطاع غزة" is
 * matched before its substring "غزة" and the substring is never re-matched
 * inside the already-consumed span.
 */
export function buildVocabularyMatcher(terms: readonly VocabularyTerm[]): VocabularyMatcher {
  const byText = new Map<string, VocabularyTerm>();

  for (const term of terms) {
    for (const candidate of [term.term, ...splitAliases(term.aliases)]) {
      const trimmed = candidate.trim();
      // ponytail: first term in the list wins on an exact duplicate string
      // across the vocabulary; a real conflict is a data-quality problem to
      // fix in the vocabulary editor, not something the matcher should guess.
      if (trimmed && !byText.has(trimmed)) byText.set(trimmed, term);
    }
  }

  if (byText.size === 0) return EMPTY_MATCHER;

  const candidates = [...byText.keys()].sort((left, right) => right.length - left.length);
  const regex = new RegExp(candidates.map(escapeRegExp).join("|"), "gu");

  return {
    findMatches(text: string): VocabularyMatch[] {
      if (!text) return [];
      const matches: VocabularyMatch[] = [];
      regex.lastIndex = 0;
      let execResult: RegExpExecArray | null;

      while ((execResult = regex.exec(text))) {
        const matchedText = execResult[0];
        const start = execResult.index;
        const end = start + matchedText.length;

        if (isWordChar(text[start - 1]) || isWordChar(text[end])) {
          // Matched inside a larger word (e.g. a substring hit) - retry one
          // character later instead of accepting a false boundary match.
          regex.lastIndex = start + 1;
          continue;
        }

        const term = byText.get(matchedText);
        if (term) {
          matches.push({
            termId: term.id,
            term: term.term,
            kind: term.kind,
            note: term.note,
            matchedText,
            start,
            end
          });
        }
      }

      return matches;
    }
  };
}

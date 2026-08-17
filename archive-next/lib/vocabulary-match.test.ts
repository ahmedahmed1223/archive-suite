import { describe, expect, test } from "vitest";
import { buildVocabularyMatcher, splitAliases } from "./vocabulary-match";
import type { VocabularyTerm } from "@/lib/archive-api";

function term(overrides: Partial<VocabularyTerm> & Pick<VocabularyTerm, "id" | "term">): VocabularyTerm {
  return {
    kind: "place",
    aliases: null,
    canonicalTermId: null,
    note: null,
    createdAt: null,
    updatedAt: null,
    ...overrides
  };
}

describe("splitAliases", () => {
  test("splits on commas, semicolons and Arabic commas, trimming blanks", () => {
    expect(splitAliases("غزة، غزّة ; Gaza,, ")).toEqual(["غزة", "غزّة", "Gaza"]);
  });

  test("returns an empty array for null/empty input", () => {
    expect(splitAliases(null)).toEqual([]);
    expect(splitAliases("")).toEqual([]);
  });
});

describe("buildVocabularyMatcher", () => {
  test("returns no matches for an empty or unavailable vocabulary", () => {
    const matcher = buildVocabularyMatcher([]);
    expect(matcher.findMatches("قطاع غزة تحت الحصار")).toEqual([]);
  });

  test("does not crash and returns no matches for empty text", () => {
    const matcher = buildVocabularyMatcher([term({ id: "t1", term: "غزة" })]);
    expect(matcher.findMatches("")).toEqual([]);
  });

  test("matches a compound term instead of double-linking its substring (longest match first)", () => {
    const matcher = buildVocabularyMatcher([
      term({ id: "compound", term: "قطاع غزة" }),
      term({ id: "single", term: "غزة" })
    ]);

    const matches = matcher.findMatches("تقرير عن قطاع غزة اليوم");
    expect(matches).toHaveLength(1);
    expect(matches[0].termId).toBe("compound");
    expect(matches[0].matchedText).toBe("قطاع غزة");
  });

  test("still matches the standalone term when the compound term is absent from the text", () => {
    const matcher = buildVocabularyMatcher([
      term({ id: "compound", term: "قطاع غزة" }),
      term({ id: "single", term: "غزة" })
    ]);

    const matches = matcher.findMatches("مدينة غزة الليلة");
    expect(matches).toHaveLength(1);
    expect(matches[0].termId).toBe("single");
    expect(matches[0].matchedText).toBe("غزة");
  });

  test("resolves a synonym/alias back to its canonical term", () => {
    const matcher = buildVocabularyMatcher([
      term({ id: "t1", term: "الأمم المتحدة", aliases: "UN, هيئة الأمم" })
    ]);

    const matches = matcher.findMatches("أعلنت هيئة الأمم عن بيان اليوم");
    expect(matches).toHaveLength(1);
    expect(matches[0].termId).toBe("t1");
    expect(matches[0].term).toBe("الأمم المتحدة");
    expect(matches[0].matchedText).toBe("هيئة الأمم");
  });

  test("does not match a term as a substring inside an unrelated larger word", () => {
    const matcher = buildVocabularyMatcher([term({ id: "t1", term: "غزة" })]);
    // "غزةستان" is not a real place, it only exists here to prove word-boundary safety.
    const matches = matcher.findMatches("غزةستان ليست مدينة");
    expect(matches).toEqual([]);
  });

  test("finds multiple distinct non-overlapping matches in order", () => {
    const matcher = buildVocabularyMatcher([
      term({ id: "gaza", term: "غزة" }),
      term({ id: "un", term: "الأمم المتحدة" })
    ]);

    const matches = matcher.findMatches("طالبت الأمم المتحدة بوقف القصف على غزة فورًا");
    expect(matches.map((match) => match.termId)).toEqual(["un", "gaza"]);
  });

  test("preserves the exact original text and diacritics around matches", () => {
    const matcher = buildVocabularyMatcher([term({ id: "t1", term: "غزة" })]);
    const text = "مدينةٌ غزة الجميلة";
    const matches = matcher.findMatches(text);
    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0].start, matches[0].end)).toBe("غزة");
    // tashkeel on the surrounding words is untouched by the matcher itself
    expect(text).toContain("مدينةٌ");
  });

  test("stays fast on realistic transcript-length text with a larger vocabulary", () => {
    const terms = Array.from({ length: 500 }, (_, index) =>
      term({ id: `t${index}`, term: `مصطلح رقم ${index}` })
    );
    terms.push(term({ id: "gaza", term: "غزة" }));
    const matcher = buildVocabularyMatcher(terms);

    const paragraph = "هذا نص طويل يتحدث عن غزة والمنطقة المحيطة بها دون أي مصطلح آخر مطابق. ".repeat(400);
    const start = performance.now();
    const matches = matcher.findMatches(paragraph);
    const elapsedMs = performance.now() - start;

    expect(matches.length).toBe(400);
    expect(elapsedMs).toBeLessThan(500);
  });
});

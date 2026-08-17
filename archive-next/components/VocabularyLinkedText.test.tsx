// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { VocabularyTerm } from "@/lib/archive-api";

const { vocabularyTerms, vocabularyKinds } = vi.hoisted(() => ({
  vocabularyTerms: vi.fn(),
  vocabularyKinds: vi.fn()
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ vocabularyTerms, vocabularyKinds })
}));

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    useLocale: () => ({
      locale: "ar",
      direction: "rtl",
      t: getDictionary("ar"),
      setLocale: vi.fn()
    })
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

import VocabularyLinkedText, { useVocabularyLinkingEnabled, VocabularyLinkToggle } from "./VocabularyLinkedText";

const GAZA_TERM: VocabularyTerm = {
  id: "term-gaza",
  term: "غزة",
  kind: "place",
  aliases: null,
  canonicalTermId: null,
  note: "قطاع فلسطيني على ساحل البحر المتوسط.",
  createdAt: null,
  updatedAt: null
};

const COMPOUND_TERM: VocabularyTerm = {
  id: "term-gaza-strip",
  term: "قطاع غزة",
  kind: "place",
  aliases: "أرض غزة",
  canonicalTermId: null,
  note: null,
  createdAt: null,
  updatedAt: null
};

function mockVocabulary(terms: VocabularyTerm[], kinds: Array<{ key: string; label: string }> = []) {
  vocabularyTerms.mockResolvedValue({ ok: true, terms, preferredTermIds: [] });
  vocabularyKinds.mockResolvedValue({
    ok: true,
    kinds: kinds.map((kind) => ({ ...kind, description: null, icon: null, order: 0, builtIn: true }))
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VocabularyLinkedText", () => {
  test("renders plain text unchanged when the vocabulary is empty", async () => {
    mockVocabulary([]);
    render(<VocabularyLinkedText text="تقرير عن قطاع غزة اليوم" />);

    expect(await screen.findByText("تقرير عن قطاع غزة اليوم")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("renders plain text and does not throw when the vocabulary request fails", async () => {
    vocabularyTerms.mockRejectedValue(new Error("network down"));
    vocabularyKinds.mockRejectedValue(new Error("network down"));

    render(<VocabularyLinkedText text="تقرير عن قطاع غزة اليوم" />);

    expect(await screen.findByText("تقرير عن قطاع غزة اليوم")).toBeInTheDocument();
  });

  test("wraps a compound term once and does not double-link its substring", async () => {
    mockVocabulary([COMPOUND_TERM, GAZA_TERM], [{ key: "place", label: "مكان" }]);
    render(<VocabularyLinkedText text="تقرير عن قطاع غزة اليوم" />);

    const term = await screen.findByText("قطاع غزة");
    expect(term.tagName).toBe("BUTTON");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("غزة")).not.toBeInTheDocument();
  });

  test("exposes the highlighted term as a focusable, accessible disclosure with a definition card", async () => {
    mockVocabulary([GAZA_TERM], [{ key: "place", label: "مكان" }]);
    render(<VocabularyLinkedText text="مدينة غزة الليلة" />);

    const trigger = await screen.findByRole("button", { name: "تعريف مصطلح «غزة»" });

    // Keyboard reachability: a real <button> is natively focusable/operable,
    // and its definition card is not rendered at all until activated.
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const card = await screen.findByRole("note");
    expect(card).toHaveTextContent("غزة");
    expect(card).toHaveTextContent("مكان");
    expect(screen.getByRole("link", { name: "فتح في المفردات" })).toHaveAttribute(
      "href",
      "/vocabulary#vocabulary-term-term-gaza"
    );
  });

  test("shows the canonical term and a synonym hint when a synonym/alias matched", async () => {
    mockVocabulary([COMPOUND_TERM], [{ key: "place", label: "مكان" }]);
    render(<VocabularyLinkedText text="سافرنا إلى أرض غزة أمس" />);

    const trigger = await screen.findByText("أرض غزة");
    fireEvent.click(trigger);

    const card = await screen.findByRole("note");
    expect(card).toHaveTextContent("قطاع غزة");
    expect(card).toHaveTextContent("مرادف لـ «قطاع غزة»");
  });

  test("keeps rendering only plain text when the per-user toggle is disabled", async () => {
    window.localStorage.setItem("masar.vocabulary-linking-enabled", "0");
    mockVocabulary([GAZA_TERM]);
    render(<VocabularyLinkedText text="مدينة غزة الليلة" />);

    await screen.findByText("مدينة غزة الليلة");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("VocabularyLinkToggle", () => {
  test("persists the preference and is reflected by useVocabularyLinkingEnabled", () => {
    function Harness() {
      const [enabled] = useVocabularyLinkingEnabled();
      return (
        <>
          <VocabularyLinkToggle />
          <span data-testid="state">{String(enabled)}</span>
        </>
      );
    }

    render(<Harness />);
    const checkbox = screen.getByRole("checkbox", { name: "ربط مصطلحات المفردات تلقائيًا" });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(window.localStorage.getItem("masar.vocabulary-linking-enabled")).toBe("0");
  });
});

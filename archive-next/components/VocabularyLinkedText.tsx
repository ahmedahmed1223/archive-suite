"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createArchiveApiClient } from "@/lib/archive-api";
import type { VocabularyTerm } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import { buildVocabularyMatcher, type VocabularyMatch } from "@/lib/vocabulary-match";
import styles from "./VocabularyLinkedText.module.css";

const TOGGLE_STORAGE_KEY = "masar.vocabulary-linking-enabled";

function readToggleStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(TOGGLE_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

function writeToggleStorage(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOGGLE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ponytail: storage may be unavailable (private mode, quota) - the
    // toggle still works for the current tab, it just won't persist.
  }
}

/** Per-user preference, shared by every surface that renders vocabulary links. */
export function useVocabularyLinkingEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readToggleStorage());
  }, []);

  function setEnabled(next: boolean) {
    setEnabledState(next);
    writeToggleStorage(next);
  }

  return [enabled, setEnabled];
}

export function VocabularyLinkToggle({ className }: Readonly<{ className?: string }>) {
  const { t } = useLocale();
  const copy = t.shared.vocabularyLinker;
  const [enabled, setEnabled] = useVocabularyLinkingEnabled();

  return (
    <label className={className}>
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
      <span>{copy.toggleLabel}</span>
    </label>
  );
}

function useVocabularySnapshot(): { terms: VocabularyTerm[]; kindLabels: Map<string, string> } {
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [kindLabels, setKindLabels] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    const api = createArchiveApiClient();

    // Both requests fail closed: an empty/unavailable vocabulary just means
    // findMatches() returns no matches, so the text renders as plain text.
    api
      .vocabularyTerms()
      .then((response) => {
        if (active && response.ok) setTerms(response.terms);
      })
      .catch(() => {});

    api
      .vocabularyKinds()
      .then((response) => {
        if (active && response.ok) {
          setKindLabels(new Map(response.kinds.map((kind) => [kind.key, kind.label])));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return { terms, kindLabels };
}

interface VocabularyTermSpanProps {
  match: VocabularyMatch;
  kindLabel: string;
  copy: AppDictionary["shared"]["vocabularyLinker"];
}

function VocabularyTermSpan({ match, kindLabel, copy }: Readonly<VocabularyTermSpanProps>) {
  const [open, setOpen] = useState(false);
  const cardId = useId();

  return (
    <span className={styles.term}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={cardId}
        aria-label={copy.definitionAriaLabel.replace("{term}", match.term)}
        onClick={() => setOpen((current) => !current)}
      >
        {match.matchedText}
      </button>
      {open ? (
        <span id={cardId} role="note" className={`panel panel-compact ${styles.card}`}>
          <span className={styles.cardTitle}>
            <strong>{match.term}</strong>
            <span className="badge">{kindLabel}</span>
          </span>
          {match.matchedText !== match.term ? <span className="helper-text">{copy.synonymOf.replace("{term}", match.term)}</span> : null}
          {match.note ? <span className="helper-text">{match.note}</span> : null}
          <Link href={`/vocabulary#vocabulary-term-${encodeURIComponent(match.termId)}`} className="button button-secondary button-sm">
            {copy.openTermPage}
          </Link>
        </span>
      ) : null}
    </span>
  );
}

interface VocabularyLinkedTextProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Renders `text` as plain content with vocabulary terms/synonyms wrapped in
 * an accessible, keyboard-operable disclosure that shows a short definition
 * card. Purely presentational: it never mutates the text it receives, it
 * only changes what gets rendered from it.
 */
export default function VocabularyLinkedText({ text, className }: Readonly<VocabularyLinkedTextProps>) {
  const { t } = useLocale();
  const copy = t.shared.vocabularyLinker;
  const { terms, kindLabels } = useVocabularySnapshot();
  const [enabled] = useVocabularyLinkingEnabled();
  const matcher = useMemo(() => buildVocabularyMatcher(terms), [terms]);
  const content = text || "";

  const matches: VocabularyMatch[] = useMemo(() => {
    if (!enabled || !content) return [];
    try {
      return matcher.findMatches(content);
    } catch {
      // Safety net: a matching bug must never crash the record read view.
      return [];
    }
  }, [matcher, content, enabled]);

  if (matches.length === 0) {
    return <span className={className}>{content}</span>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) nodes.push(content.slice(cursor, match.start));
    nodes.push(
      <VocabularyTermSpan
        key={`${match.termId}-${match.start}-${index}`}
        match={match}
        kindLabel={kindLabels.get(match.kind) || match.kind}
        copy={copy}
      />
    );
    cursor = match.end;
  });
  if (cursor < content.length) nodes.push(content.slice(cursor));

  return <span className={className}>{nodes}</span>;
}

import { normalizeArabicSearchText } from "../../utils/formatting.js";

export type VoiceSearchIntentKind = "empty" | "search" | "open" | "add";

interface CommandPrefix {
  kind: Exclude<VoiceSearchIntentKind, "empty">;
  prefixes: string[];
}

const COMMAND_PREFIXES: CommandPrefix[] = [
  { kind: "search", prefixes: ["ابحث عن", "ابحث", "بحث عن", "بحث", "دور على", "دور"] },
  { kind: "open", prefixes: ["افتح لي", "افتح", "شغل", "اعرض"] },
  { kind: "add", prefixes: ["اضف", "اضافه", "انشئ", "سجل"] }
];

type SpeechRecognitionConstructor = (...args: never[]) => unknown;

export interface VoiceSearchScope {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface SpeechTranscriptEvent {
  resultIndex?: number;
  results?: Array<Array<{ transcript?: string }>>;
}

export interface VoiceSearchIntent {
  kind: VoiceSearchIntentKind;
  query: string;
  normalizedQuery: string;
  rawTranscript: string;
  normalizedTranscript: string;
}

function compactText(value = ""): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenizeNormalized(value = ""): string[] {
  return normalizeArabicSearchText(value).split(/\s+/).filter(Boolean);
}

export function getSpeechRecognitionConstructor(
  scope: VoiceSearchScope = globalThis as VoiceSearchScope
): SpeechRecognitionConstructor | null {
  return scope?.SpeechRecognition || scope?.webkitSpeechRecognition || null;
}

export function isVoiceSearchSupported(scope: VoiceSearchScope = globalThis as VoiceSearchScope): boolean {
  return Boolean(getSpeechRecognitionConstructor(scope));
}

export function extractSpeechTranscript(event: SpeechTranscriptEvent = {}): string {
  const resultIndex = Number.isInteger(event.resultIndex) ? event.resultIndex as number : 0;
  const result = event.results?.[resultIndex] || event.results?.[0];
  return compactText(result?.[0]?.transcript || "");
}

export function parseVoiceSearchIntent(transcript = ""): VoiceSearchIntent {
  const rawTranscript = compactText(transcript);
  const normalizedTranscript = normalizeArabicSearchText(rawTranscript);

  if (!rawTranscript) {
    return {
      kind: "empty",
      query: "",
      normalizedQuery: "",
      rawTranscript: "",
      normalizedTranscript: ""
    };
  }

  const rawWords = rawTranscript.split(/\s+/).filter(Boolean);
  const normalizedWords = rawWords.map((word) => normalizeArabicSearchText(word));

  for (const command of COMMAND_PREFIXES) {
    for (const prefix of command.prefixes) {
      const prefixWords = tokenizeNormalized(prefix);
      const matches = prefixWords.every((word, index) => normalizedWords[index] === word);
      if (!matches) continue;

      const query = compactText(rawWords.slice(prefixWords.length).join(" "));
      return {
        kind: command.kind,
        query,
        normalizedQuery: normalizeArabicSearchText(query),
        rawTranscript,
        normalizedTranscript
      };
    }
  }

  return {
    kind: "search",
    query: rawTranscript,
    normalizedQuery: normalizedTranscript,
    rawTranscript,
    normalizedTranscript
  };
}

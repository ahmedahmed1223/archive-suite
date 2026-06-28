// AI assist - pure helpers for applying AiProvider results to form state.
//
// The provider calls themselves live in useAiAssist.js (a thin React hook); the
// data shaping below is pure and unit-tested. Keeping it provider-agnostic means
// the same logic works for the cloud adapter and any future provider.

import { parseVideoTags as parseVideoTagsRaw } from "../videos/viewModel.js";

export type ContentTypeLike = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
};

export type SuggestPayloadInput = {
  title?: string;
  notes?: string;
  transcription?: string;
  contentTypes?: ContentTypeLike[];
};

export type WorkbenchAction = {
  id: string;
  label: string;
  target: string;
  method: string;
};

/**
 * Merge a comma/،-separated tag string with newly suggested tags, de-duplicating
 * case-insensitively while preserving the user's existing order.
 */
export function mergeTagText(existingText = "", addedTags: unknown[] = []): string {
  const parseVideoTags = parseVideoTagsRaw as unknown as (value: string) => string[];
  const existing = parseVideoTags(existingText);
  const seen = new Set(existing.map((t: string) => t.trim().toLowerCase()));
  const merged = [...existing];
  for (const raw of Array.isArray(addedTags) ? addedTags : []) {
    const tag = String(raw || "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
  }
  return merged.join("، ");
}

/** Shape content types into the {id,name} categories the suggestTags port expects. */
export function contentTypesToCategories(contentTypes: ContentTypeLike[] = []): Array<{ id: string; name: string }> {
  return (Array.isArray(contentTypes) ? contentTypes : [])
    .filter((t) => t && t.id && t.status !== "archived")
    .map((t) => ({ id: String(t.id), name: t.name || t.label || "" }));
}

/** Apply a proofread result to the notes text (falls back to the original). */
export function applyProofread(text = "", result: { correctedText?: unknown } = {}): string {
  const corrected = typeof result?.correctedText === "string" ? result.correctedText.trim() : "";
  return corrected || text;
}

/** How many corrections a proofread result reported. */
export function correctionsCount(result: { corrections?: unknown[] } = {}): number {
  return Array.isArray(result?.corrections) ? result.corrections.length : 0;
}

/**
 * Fold a summary into the notes field: fill when empty, otherwise append below
 * the existing notes (never silently overwrite the user's text).
 */
export function applySummaryToNotes(notes = "", summary = ""): string {
  const clean = String(summary || "").trim();
  if (!clean) return notes;
  const current = String(notes || "").trim();
  return current ? `${current}\n\n${clean}` : clean;
}

/** Build the suggestTags / summarize payload from the current draft + types. */
export function buildSuggestPayload({ title = "", notes = "", transcription = "", contentTypes = [] }: SuggestPayloadInput = {}) {
  return {
    name: String(title || "").trim(),
    summary: String(notes || "").trim(),
    transcription: String(transcription || ""),
    categories: contentTypesToCategories(contentTypes)
  };
}

/** Whether there is enough source text for summarize/proofread to be meaningful. */
export function hasSourceText({ title = "", notes = "", transcription = "" }: SuggestPayloadInput = {}): boolean {
  return Boolean(String(notes || "").trim() || String(transcription || "").trim() || String(title || "").trim());
}

export function createAiWorkbenchActions({ show = {}, canEditNotes = true, canEditTags = true }: {
  show?: Partial<Record<"summarize" | "tags" | "proofread", boolean>>;
  canEditNotes?: boolean;
  canEditTags?: boolean;
} = {}): WorkbenchAction[] {
  const cfg = { summarize: true, tags: true, proofread: true, ...show };
  return [
    cfg.summarize && canEditNotes ? { id: "summarize", label: "تلخيص", target: "الملاحظات", method: "summarize" } : null,
    cfg.tags && canEditTags ? { id: "suggestTags", label: "اقتراح وسوم", target: "الوسوم", method: "suggestTags" } : null,
    cfg.proofread && canEditNotes ? { id: "proofread", label: "تدقيق", target: "الملاحظات", method: "proofread" } : null
  ].filter(Boolean) as WorkbenchAction[];
}

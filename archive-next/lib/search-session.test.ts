import { describe, expect, it } from "vitest";
import {
  clearSearchSessionForPersonalContext,
  resetSearchSession,
  resolveSearchSession,
  searchSessionActiveFilters,
  type SearchSession,
} from "./search-session";

const defaults: SearchSession = {
  q: "",
  store: "",
  type: "all",
  tag: "",
  mode: "keyword",
  dateFrom: "",
  dateTo: "",
  descriptionState: "",
  view: "cards",
  density: "comfortable",
  previewId: null,
};

describe("resolveSearchSession", () => {
  it("uses a recognized URL search session atomically over every fallback", () => {
    const session = resolveSearchSession({
      url: "q=URL%20query&type=video",
      saved: { q: "saved", tag: "saved-tag", view: "list" },
      persisted: { store: "persisted-store", previewId: "record-1" },
      defaults,
    });

    expect(session).toEqual({ ...defaults, q: "URL query", type: "video" });
  });

  it("ignores unrelated URL parameters and restores the explicitly selected saved search", () => {
    const session = resolveSearchSession({
      url: "tab=history",
      saved: { q: "saved", store: "news", type: "audio", tag: "today" },
      persisted: { q: "persisted", view: "list" },
      defaults,
    });

    expect(session).toMatchObject({ q: "saved", store: "news", type: "audio", tag: "today" });
    expect(session.view).toBe("cards");
  });

  it("uses persisted state only when neither URL nor saved search supplies a session", () => {
    expect(resolveSearchSession({
      url: "page=2",
      persisted: { q: "restored", mode: "semantic", view: "list", previewId: "record-7" },
      defaults,
    })).toEqual({ ...defaults, q: "restored", mode: "semantic", view: "list", previewId: "record-7" });
  });

  it("rejects invalid URL values without treating them as a session", () => {
    expect(resolveSearchSession({
      url: "mode=unsafe&dateFrom=not-a-date",
      persisted: { q: "safe fallback" },
      defaults,
    })).toMatchObject({ q: "safe fallback", mode: "keyword", dateFrom: "" });
  });

  it("clears personal search context rather than restoring it when recording is disabled", () => {
    const session = resolveSearchSession({
      url: "tab=history",
      saved: { q: "saved", tag: "private" },
      persisted: { q: "persisted", store: "private-store", previewId: "record-1", view: "list" },
      defaults,
      isContextRecordingEnabled: false,
    });

    expect(session).toEqual({ ...defaults, view: "list" });
  });
});

describe("search session helpers", () => {
  it("resets all search constraints and transient preview state while retaining display preferences", () => {
    expect(resetSearchSession({ ...defaults, q: "term", type: "video", previewId: "record-1", view: "list" }))
      .toEqual({ ...defaults, view: "list" });
  });

  it("identifies each active shareable search filter in a stable order", () => {
    expect(searchSessionActiveFilters({
      ...defaults, q: "term", store: "main", type: "video", tag: "news", mode: "semantic",
      dateFrom: "2026-01-01", dateTo: "2026-01-31", descriptionState: "complete",
    })).toEqual(["q", "store", "type", "tag", "mode", "dateFrom", "dateTo", "descriptionState"]);
  });

  it("clears only personal context while keeping view and density", () => {
    expect(clearSearchSessionForPersonalContext({
      ...defaults, q: "term", store: "main", previewId: "record-1", view: "list", density: "compact",
    })).toEqual({ ...defaults, view: "list", density: "compact" });
  });
});

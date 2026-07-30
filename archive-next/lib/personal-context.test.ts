// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { isContextRecordingEnabled, setContextRecording } from "./personal-context";
import { clearRecent, listRecent, recordView } from "./recent-items";
import { clearRecentSearches, listRecentSearches, recordRecentSearch } from "./recent-searches";

afterEach(() => {
  window.localStorage.clear();
});

describe("personal-context (V1-838)", () => {
  test("recording is on until the user opts out", () => {
    expect(isContextRecordingEnabled()).toBe(true);
    setContextRecording(false);
    expect(isContextRecordingEnabled()).toBe(false);
    setContextRecording(true);
    expect(isContextRecordingEnabled()).toBe(true);
  });

  test("opting out stops both recorders, and opting back in resumes them", () => {
    setContextRecording(false);
    recordView("rec-1", "مادة");
    recordRecentSearch("استعلام تجريبي");
    expect(listRecent()).toHaveLength(0);
    expect(listRecentSearches()).toHaveLength(0);

    setContextRecording(true);
    recordView("rec-1", "مادة");
    recordRecentSearch("استعلام تجريبي");
    expect(listRecent()).toHaveLength(1);
    expect(listRecentSearches()).toHaveLength(1);
  });

  test("clearing empties each store without touching the other", () => {
    recordView("rec-1", "مادة");
    recordRecentSearch("استعلام تجريبي");

    clearRecent();
    expect(listRecent()).toHaveLength(0);
    expect(listRecentSearches()).toHaveLength(1);

    clearRecentSearches();
    expect(listRecentSearches()).toHaveLength(0);
  });
});

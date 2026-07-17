// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "@/lib/local-draft";

afterEach(() => {
  window.localStorage.clear();
});

describe("local-draft", () => {
  test("returns null when no draft is saved", () => {
    expect(loadDraft("missing-key")).toBeNull();
  });

  test("saves and loads a draft with a timestamp", () => {
    saveDraft("my-form", { title: "مسودة" });

    const draft = loadDraft<{ title: string }>("my-form");
    expect(draft?.data).toEqual({ title: "مسودة" });
    expect(typeof draft?.savedAt).toBe("string");
  });

  test("clears a saved draft", () => {
    saveDraft("my-form", { title: "مسودة" });
    clearDraft("my-form");

    expect(loadDraft("my-form")).toBeNull();
  });

  test("keeps drafts under different keys independent", () => {
    saveDraft("form-a", { value: 1 });
    saveDraft("form-b", { value: 2 });

    expect(loadDraft<{ value: number }>("form-a")?.data.value).toBe(1);
    expect(loadDraft<{ value: number }>("form-b")?.data.value).toBe(2);
  });
});

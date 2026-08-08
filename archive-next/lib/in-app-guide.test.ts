import { describe, expect, it, vi } from "vitest";
import { getGuideChapters } from "./guide-content";
import { filterGuideChapters, getGuideChapterForPath } from "./in-app-guide";

const chapters = [
  { id: "viewer-search", title: "البحث", audience: ["viewer", "editor", "admin"], body: "ابحث عن السجلات ثم احفظ النتيجة.", href: "/search" },
  { id: "editor-upload", title: "إضافة مواد", audience: ["editor", "admin"], body: "أضف الملفات والوصف.", href: "/uploads" },
  { id: "admin-users", title: "إدارة المستخدمين", audience: ["admin"], body: "أضف المستخدمين وراجع الأدوار.", href: "/settings/users" },
] as const;

describe("in-app guide", () => {
  it("publishes stable role-aware chapter entries with routable links", () => {
    const manifestChapters = getGuideChapters("admin", "ar");

    expect(manifestChapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "viewer-search", audience: ["viewer", "editor", "admin"], href: "/search" }),
        expect.objectContaining({ id: "editor-upload", audience: ["editor", "admin"], href: "/uploads" }),
        expect.objectContaining({ id: "admin-operations", audience: ["admin"], href: "/settings/users" }),
      ]),
    );
    expect(manifestChapters.every((chapter) => chapter.href.startsWith("/") && chapter.body.trim().length > 0)).toBe(true);
  });

  it("limits chapters to the authenticated role", () => {
    expect(filterGuideChapters(chapters, "viewer", "").map((chapter) => chapter.id)).toEqual(["viewer-search"]);
    expect(filterGuideChapters(chapters, "editor", "").map((chapter) => chapter.id)).toEqual(["viewer-search", "editor-upload"]);
  });

  it("does not load restricted chapter bodies into a viewer guide payload", () => {
    const reader = vi.fn((path: string) => `body:${path.replaceAll("\\", "/").split("/").at(-1)}`);
    const viewerPayload = getGuideChapters("viewer", "en", reader);

    expect(viewerPayload.map((chapter) => chapter.id)).toEqual(["viewer-search", "whats-new"]);
    expect(viewerPayload.map((chapter) => chapter.title)).toEqual(["Search and access records", "What’s new"]);
    expect(reader.mock.calls.map(([path]) => path.replaceAll("\\", "/").split("/").at(-1))).toEqual([
      "viewer-search.html",
      "whats-new.html",
    ]);
  });

  it("reads only Arabic file variants for an Arabic payload", () => {
    const reader = vi.fn((path: string) => `body:${path}`);

    getGuideChapters("viewer", "ar", reader);

    expect(reader.mock.calls.map(([path]) => path.replaceAll("\\", "/").split("/").at(-1))).toEqual([
      "viewer-search.ar.html",
      "whats-new.ar.html",
    ]);
  });

  it("publishes current supported capabilities without historical stage language", () => {
    const whatsNew = getGuideChapters("viewer", "ar").find((chapter) => chapter.id === "whats-new");

    expect(whatsNew?.body).toContain("حزم Native مدعومة بالكامل");
    expect(whatsNew?.body).toContain("اختر لغة الواجهة");
    expect(whatsNew?.body).not.toContain("31 يوليو");
  });

  it("searches Arabic chapter titles and Markdown body without exposing restricted chapters", () => {
    expect(filterGuideChapters(chapters, "editor", "الوصف").map((chapter) => chapter.id)).toEqual(["editor-upload"]);
    expect(filterGuideChapters(chapters, "viewer", "المستخدمين")).toEqual([]);
  });

  it("finds the closest contextual chapter for a page path", () => {
    expect(getGuideChapterForPath("/settings/users/42", chapters)?.id).toBe("admin-users");
    expect(getGuideChapterForPath("/unknown", chapters)).toBeUndefined();
  });
});

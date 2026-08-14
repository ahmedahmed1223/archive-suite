import { readdirSync } from "node:fs";
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
        expect.objectContaining({ id: "admin-operations", audience: ["admin"], href: "/status" }),
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

    expect(viewerPayload.map((chapter) => chapter.id)).toEqual([
      "getting-started",
      "viewer-search",
      "files-previews",
      "rights-sharing",
      "whats-new",
    ]);
    expect(viewerPayload.map((chapter) => chapter.title)).toEqual([
      "Getting started and navigation",
      "Search and access records",
      "Files, previews, and downloads",
      "Rights and sharing",
      "What’s new",
    ]);
    expect(reader.mock.calls.map(([path]) => path.replaceAll("\\", "/").split("/").at(-1))).toEqual([
      "getting-started.html",
      "viewer-search.html",
      "files-previews.html",
      "rights-sharing.html",
      "whats-new.html",
    ]);
  });

  it("publishes all eleven bilingual HTML chapter families with complete task sections", () => {
    const expectedIds = [
      "getting-started",
      "viewer-search",
      "files-previews",
      "rights-sharing",
      "editor-upload",
      "collaboration-projects",
      "media-review",
      "users-permissions",
      "settings-integrations",
      "admin-operations",
      "whats-new",
    ];
    const arabic = getGuideChapters("admin", "ar");
    const english = getGuideChapters("admin", "en");
    const guideFiles = readdirSync(new URL("../content/guide", import.meta.url)).sort();

    expect(arabic.map((chapter) => chapter.id)).toEqual(expectedIds);
    expect(english.map((chapter) => chapter.id)).toEqual(expectedIds);
    expect(guideFiles).toHaveLength(22);
    expect(guideFiles.every((file) => file.endsWith(".html"))).toBe(true);

    for (const chapter of arabic) {
      expect(chapter.href).toMatch(/^\//);
      expect(chapter.body).toContain("<h3>النتيجة</h3>");
      expect(chapter.body).toContain("<h3>قبل أن تبدأ</h3>");
      expect(chapter.body).toContain("<h3>الخطوات</h3>");
      expect(chapter.body).toContain("<h3>التحقق</h3>");
    }
    for (const chapter of english) {
      expect(chapter.body).toContain("<h3>Outcome</h3>");
      expect(chapter.body).toContain("<h3>Before you begin</h3>");
      expect(chapter.body).toContain("<h3>Procedure</h3>");
      expect(chapter.body).toContain("<h3>Verify</h3>");
    }

    const publicGuideText = [...arabic, ...english].map((chapter) => chapter.body).join("\n");
    expect(publicGuideText).not.toMatch(/\b(?:gpu|cutoff|todo|roadmap|unfinished)\b|مؤجل|قيد التنفيذ/i);
  });

  it("reads only Arabic file variants for an Arabic payload", () => {
    const reader = vi.fn((path: string) => `body:${path}`);

    getGuideChapters("viewer", "ar", reader);

    expect(reader.mock.calls.map(([path]) => path.replaceAll("\\", "/").split("/").at(-1))).toEqual([
      "getting-started.ar.html",
      "viewer-search.ar.html",
      "files-previews.ar.html",
      "rights-sharing.ar.html",
      "whats-new.ar.html",
    ]);
  });

  it("publishes current supported capabilities without historical stage language", () => {
    const whatsNew = getGuideChapters("viewer", "ar").find((chapter) => chapter.id === "whats-new");

    expect(whatsNew?.body).toContain("حزم Native مدعومة بالكامل");
    expect(whatsNew?.body).toContain("اختر لغة الواجهة");
    expect(whatsNew?.body).toMatch(/الدعم الكامل\s+للإنجليزية/);
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

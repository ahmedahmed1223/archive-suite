export type GuideRole = "admin" | "editor" | "viewer";

export type GuideChapter = {
  id: string;
  title: string;
  audience: readonly GuideRole[];
  body: string;
  href: string;
};

export function getGuideRoles(locale: AppLocale): readonly { value: GuideRole; label: string }[] {
  return locale === "ar"
    ? [
        { value: "viewer", label: "المستعرض" },
        { value: "editor", label: "المحرر" },
        { value: "admin", label: "المدير" },
      ]
    : [
        { value: "viewer", label: "Viewer" },
        { value: "editor", label: "Editor" },
        { value: "admin", label: "Administrator" },
      ];
}

export function filterGuideChapters<T extends GuideChapter>(
  chapters: readonly T[],
  role: GuideRole,
  query: string,
  locale: AppLocale = "ar",
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  return chapters.filter((chapter) =>
    chapter.audience.includes(role) &&
    (!normalizedQuery || `${chapter.title} ${chapter.body.replace(/<[^>]*>/g, " ")}`.toLocaleLowerCase(locale).includes(normalizedQuery)),
  );
}

/** Returns the most specific guide route that contains the current page. */
export function getGuideChapterForPath<T extends GuideChapter>(path: string, chapters: readonly T[]): T | undefined {
  return chapters
    .filter((chapter) => path === chapter.href || path.startsWith(`${chapter.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
import type { AppLocale } from "./i18n/types";

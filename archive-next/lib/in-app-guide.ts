export type GuideRole = "admin" | "editor" | "viewer";

export type GuideChapter = {
  id: string;
  title: string;
  audience: readonly GuideRole[];
  body: string;
  href: string;
};

export function filterGuideChapters<T extends GuideChapter>(
  chapters: readonly T[],
  role: GuideRole,
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  return chapters.filter((chapter) =>
    chapter.audience.includes(role) &&
    (!normalizedQuery || `${chapter.title} ${chapter.body}`.toLocaleLowerCase("ar").includes(normalizedQuery)),
  );
}

/** Returns the most specific guide route that contains the current page. */
export function getGuideChapterForPath<T extends GuideChapter>(path: string, chapters: readonly T[]): T | undefined {
  return chapters
    .filter((chapter) => path === chapter.href || path.startsWith(`${chapter.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

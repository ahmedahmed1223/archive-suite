import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GuideChapter, GuideRole } from "@/lib/in-app-guide";
import type { AppLocale } from "@/lib/i18n/types";

type GuideManifestEntry = Omit<GuideChapter, "body" | "title"> & {
  sourceStem: string;
  titles: Record<AppLocale, string>;
};

type ChapterReader = (path: string, encoding: BufferEncoding) => string;

const manifest: readonly GuideManifestEntry[] = [
  { id: "viewer-search", titles: { ar: "البحث والوصول إلى السجلات", en: "Search and access records" }, audience: ["viewer", "editor", "admin"], href: "/search", sourceStem: "viewer-search" },
  { id: "editor-upload", titles: { ar: "إضافة المواد ووصفها", en: "Add and describe materials" }, audience: ["editor", "admin"], href: "/uploads", sourceStem: "editor-upload" },
  { id: "admin-operations", titles: { ar: "إدارة النظام والتشغيل", en: "System administration and operations" }, audience: ["admin"], href: "/settings/users", sourceStem: "admin-operations" },
  { id: "whats-new", titles: { ar: "ما الجديد في الإصدار", en: "What’s new" }, audience: ["viewer", "editor", "admin"], href: "/help", sourceStem: "whats-new" },
];

export function getGuideChapters(
  role: GuideRole,
  locale: AppLocale,
  readChapter: ChapterReader = readFileSync,
): GuideChapter[] {
  const authorizedEntries = manifest.filter((chapter) => chapter.audience.includes(role));

  return authorizedEntries.map(({ sourceStem, titles, ...chapter }) => ({
    ...chapter,
    title: titles[locale],
    body: readChapter(
      join(process.cwd(), "content", "guide", `${sourceStem}${locale === "ar" ? ".ar" : ""}.md`),
      "utf8",
    ),
  }));
}

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

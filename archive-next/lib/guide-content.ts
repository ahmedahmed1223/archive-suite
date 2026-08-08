import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GuideChapter, GuideRole } from "@/lib/in-app-guide";
import type { AppLocale } from "@/lib/i18n/types";
import { sanitizeGuideHtml } from "@/lib/guide-html";

type GuideManifestEntry = Omit<GuideChapter, "body" | "title"> & {
  sourceStem: string;
  titles: Record<AppLocale, string>;
};

type ChapterReader = (path: string, encoding: BufferEncoding) => string;

const manifest: readonly GuideManifestEntry[] = [
  { id: "getting-started", titles: { ar: "البدء والتنقل", en: "Getting started and navigation" }, audience: ["viewer", "editor", "admin"], href: "/", sourceStem: "getting-started" },
  { id: "viewer-search", titles: { ar: "البحث والوصول إلى السجلات", en: "Search and access records" }, audience: ["viewer", "editor", "admin"], href: "/search", sourceStem: "viewer-search" },
  { id: "files-previews", titles: { ar: "الملفات والمعاينات والتنزيل", en: "Files, previews, and downloads" }, audience: ["viewer", "editor", "admin"], href: "/files", sourceStem: "files-previews" },
  { id: "rights-sharing", titles: { ar: "الحقوق والمشاركة", en: "Rights and sharing" }, audience: ["viewer", "editor", "admin"], href: "/rights", sourceStem: "rights-sharing" },
  { id: "editor-upload", titles: { ar: "إضافة المواد ووصفها", en: "Add and describe materials" }, audience: ["editor", "admin"], href: "/uploads", sourceStem: "editor-upload" },
  { id: "collaboration-projects", titles: { ar: "المجموعات والمشاريع والتعاون", en: "Projects and collaboration" }, audience: ["editor", "admin"], href: "/projects", sourceStem: "collaboration-projects" },
  { id: "media-review", titles: { ar: "معالجة الوسائط ومراجعتها", en: "Media processing and review" }, audience: ["editor", "admin"], href: "/media/jobs", sourceStem: "media-review" },
  { id: "users-permissions", titles: { ar: "المستخدمون والأدوار والصلاحيات", en: "Users, roles, and permissions" }, audience: ["admin"], href: "/settings/users", sourceStem: "users-permissions" },
  { id: "settings-integrations", titles: { ar: "الإعدادات والتخزين والتكاملات", en: "Settings, storage, and integrations" }, audience: ["admin"], href: "/settings", sourceStem: "settings-integrations" },
  { id: "admin-operations", titles: { ar: "النسخ الاحتياطي والصحة والدعم", en: "Backup, recovery, health, and support" }, audience: ["admin"], href: "/status", sourceStem: "admin-operations" },
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
    body: sanitizeGuideHtml(readChapter(
      join(process.cwd(), "content", "guide", `${sourceStem}${locale === "ar" ? ".ar" : ""}.html`),
      "utf8",
    )),
  }));
}

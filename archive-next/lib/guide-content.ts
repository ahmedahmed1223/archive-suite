import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterGuideChapters, type GuideChapter, type GuideRole } from "@/lib/in-app-guide";

type GuideManifestEntry = Omit<GuideChapter, "body"> & { source: string };

const manifest: readonly GuideManifestEntry[] = [
  { id: "viewer-search", title: "البحث والوصول إلى السجلات", audience: ["viewer", "editor", "admin"], href: "/search", source: "viewer-search.md" },
  { id: "editor-upload", title: "إضافة المواد ووصفها", audience: ["editor", "admin"], href: "/uploads", source: "editor-upload.md" },
  { id: "admin-operations", title: "إدارة النظام والتشغيل", audience: ["admin"], href: "/settings/users", source: "admin-operations.md" },
  { id: "whats-new", title: "ما الجديد في الإصدار", audience: ["viewer", "editor", "admin"], href: "/help", source: "whats-new.md" },
];

export function getGuideChapters(role?: GuideRole): GuideChapter[] {
  const chapters = manifest.map(({ source, ...chapter }) => ({
    ...chapter,
    body: readFileSync(join(process.cwd(), "content", "guide", source), "utf8"),
  }));

  return role ? filterGuideChapters(chapters, role, "") : chapters;
}

export const guideRoles: readonly { value: GuideRole; label: string }[] = [
  { value: "viewer", label: "المستعرض" },
  { value: "editor", label: "المحرر" },
  { value: "admin", label: "المدير" },
];

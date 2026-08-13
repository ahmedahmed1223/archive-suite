import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const tagsPage = source("app/tags/page.tsx");
const kanbanPage = source("app/kanban/page.tsx");
const collectionsPage = source("app/collections/page.tsx");
const projectsPage = source("app/projects/page.tsx");
const tagsDictionary = source("lib/i18n/dictionaries/ar/pages/tags.ts");
const collectionsDictionary = source("lib/i18n/dictionaries/ar/pages/collections.ts");
const projectsDictionary = source("lib/i18n/dictionaries/ar/pages/projects.ts");
const kanbanDictionary = source("lib/i18n/dictionaries/ar/pages/kanban.ts");

describe("organization and quality workspace contracts", () => {
  it("describes tag parent changes as structural with no record mutation", () => {
    expect(tagsPage).toContain("const copy = t.pages.tags;");
    expect(tagsPage).toContain("copy.parentHelp");
    expect(tagsDictionary).toContain("تغيير الأب هيكلي فقط ولا يعدّل أي سجل");
    expect(tagsPage).not.toContain('action: "move", entity: `الوسم');
  });

  it("keeps the accessible Kanban move control available for every card", () => {
    expect(kanbanPage).not.toContain("items.slice(0, 24)");
    expect(kanbanDictionary).toContain("جميع البطاقات متاحة عبر قائمة النقل");
  });

  it("does not present a collection match count until records are ready", () => {
    expect(collectionsPage).toContain('state.status === "ready" ? records.filter');
    expect(collectionsPage).toContain("copy.countUnavailable");
    expect(collectionsDictionary).toContain("تعذر تأكيد عدد السجلات قبل اكتمال التحميل");
  });

  it("requires explicit destructive confirmation for local projects and clips", () => {
    expect(projectsPage).toContain("copy.dialogs.deleteProjectMessage");
    expect(projectsPage).toContain("copy.dialogs.deleteClipMessage");
    expect(projectsDictionary).toContain("حذف المشروع محليًا غير قابل للتراجع");
    expect(projectsDictionary).toContain("حذف القصاصة من هذا الخط الزمني غير قابل للتراجع");
  });
});

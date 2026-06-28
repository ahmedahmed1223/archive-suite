export { PAGE_CONTEXT_META } from "./pageManifest.js";

import { PAGE_CONTEXT_META, type PageMeta } from "./pageManifest.js";

export function getPageContextMeta(page: string, fallbackTitle = "أرشيف الفيديو"): PageMeta {
  return PAGE_CONTEXT_META[page] || {
    title: fallbackTitle,
    breadcrumb: "أرشيف الفيديو",
    hint: "انتقل بين الشاشات من هنا مع مساعدة سياقية عند الحاجة.",
    helpSection: "getting-started"
  };
}

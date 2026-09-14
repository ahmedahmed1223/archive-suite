import type { AppLocale } from "../types";

export function hierarchyTreeCopy(locale: AppLocale) {
  return locale === "ar"
    ? { expand: "توسيع أبناء {title}", collapse: "طي أبناء {title}", childCount: "{count} عقد تابعة" }
    : { expand: "Expand children of {title}", collapse: "Collapse children of {title}", childCount: "{count} children" };
}

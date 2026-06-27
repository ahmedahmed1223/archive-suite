import { describe, expect, it } from "vitest";

import {
  createHelpContextCards,
  filterHelpContextCards
} from "./viewModel.js";

describe("help view model", () => {
  const manifest = [
    {
      id: "archive",
      group: "daily",
      heavy: false,
      meta: {
        title: "الأرشيف",
        breadcrumb: "الرئيسية / الأرشيف",
        hint: "تصفية، معاينة، تحديد متعدد، وإضافة فيديو من نفس المسار.",
        helpSection: "dashboard-archive"
      }
    },
    {
      id: "backup",
      group: "maintenance",
      heavy: true,
      meta: {
        title: "مركز البيانات",
        breadcrumb: "الصيانة / النسخ والنقل",
        hint: "تصدير، استيراد، نقل لجهاز آخر، ونسخ احتياطي بخطوات واضحة.",
        helpSection: "transfer-export"
      }
    }
  ];

  it("creates contextual help cards from page metadata", () => {
    expect(createHelpContextCards(manifest)).toEqual([
      {
        id: "archive",
        title: "الأرشيف",
        breadcrumb: "الرئيسية / الأرشيف",
        hint: "تصفية، معاينة، تحديد متعدد، وإضافة فيديو من نفس المسار.",
        helpSection: "dashboard-archive",
        group: "daily",
        heavy: false,
        keywords: "الأرشيف الرئيسية / الأرشيف تصفية، معاينة، تحديد متعدد، وإضافة فيديو من نفس المسار. dashboard-archive"
      },
      {
        id: "backup",
        title: "مركز البيانات",
        breadcrumb: "الصيانة / النسخ والنقل",
        hint: "تصدير، استيراد، نقل لجهاز آخر، ونسخ احتياطي بخطوات واضحة.",
        helpSection: "transfer-export",
        group: "maintenance",
        heavy: true,
        keywords: "مركز البيانات الصيانة / النسخ والنقل تصدير، استيراد، نقل لجهاز آخر، ونسخ احتياطي بخطوات واضحة. transfer-export"
      }
    ]);
  });

  it("filters contextual cards by Arabic text, breadcrumb, and linked section", () => {
    const cards = createHelpContextCards(manifest);

    expect(filterHelpContextCards(cards, "نسخ")).toEqual([cards[1]]);
    expect(filterHelpContextCards(cards, "dashboard")).toEqual([cards[0]]);
    expect(filterHelpContextCards(cards, "")).toEqual(cards);
  });
});

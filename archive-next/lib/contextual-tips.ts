// ponytail: contextual tips per page, persisted in localStorage
export interface Tip {
  title: string;
  description: string;
  icon?: string;
}

export type PageKey = "search" | "archive" | "collections" | "settings" | "montage";

export const pageTips: Record<PageKey, Tip[]> = {
  search: [
    {
      title: "البحث المتقدم",
      description: "استخدم عوامل التصفية لتضييق النتائج حسب التاريخ أو النوع أو الحالة",
      icon: "Filter"
    },
    {
      title: "حفظ عمليات البحث",
      description: "يمكنك حفظ عمليات البحث المفضلة لاستعادتها بسرعة لاحقاً"
    },
    {
      title: "المفاتيح السريعة",
      description: "اضغط Ctrl+K لفتح لوحة الأوامر والبحث عن السجلات مباشرة",
      icon: "Keyboard"
    },
    {
      title: "عرض النتائج",
      description: "بدّل بين عروض الجدول والبطاقات من شريط الأدوات"
    },
    {
      title: "المقاييس",
      description: "شريط المقاييس أعلاه يعرض ملخص عدد السجلات والفئات"
    }
  ],
  archive: [
    {
      title: "السجلات",
      description: "كل سجل يمثل عنصراً واحداً من مجموعتك — مع البيانات الوصفية والملفات المرتبطة",
      icon: "FileText"
    },
    {
      title: "تعديل السجلات",
      description: "انقر على سجل لعرض التفاصيل الكاملة والتعديل على البيانات الوصفية",
      icon: "Edit"
    },
    {
      title: "الملفات المرتبطة",
      description: "تصفح الوسائط والملفات المرفقة بالسجل من تبويب الملفات"
    },
    {
      title: "المشاركة والحقوق",
      description: "تحكم في من يمكنه الوصول إلى السجل من خلال إنشاء روابط مشاركة",
      icon: "Share"
    },
    {
      title: "الحالات",
      description: "تتبع حالة السجل (مسودة، مراجعة، منشور) من الشريط الجانبي"
    }
  ],
  montage: [
    {
      title: "عرض المونتاج",
      description: "نسق البطاقات والصور بشكل مرئي لمقارنة السجلات وتجميعها",
      icon: "Grid"
    },
    {
      title: "إعادة الترتيب",
      description: "اسحب وأفلت البطاقات لتنظيم العناصر بالطريقة التي تريدها"
    },
    {
      title: "التصفية السريعة",
      description: "استخدم عوامل التصفية في الشريط الجانبي لإظهار مجموعات معينة فقط"
    },
    {
      title: "التصدير",
      description: "صدّر قائمة المجموعة الحالية بصيغة CSV أو JSON للمعالجة الإضافية"
    },
    {
      title: "الإضافة السريعة",
      description: "استخدم زر '+' لإنشاء سجلات جديدة أثناء العرض دون مغادرة الصفحة"
    }
  ],
  settings: [
    {
      title: "الإعدادات الشخصية",
      description: "عدّل تفضيلاتك، اللغة، والمظهر من صفحة الإعدادات",
      icon: "Settings"
    },
    {
      title: "المتقدمة",
      description: "خيارات متقدمة متاحة لتخصيص السلوك والأداء"
    },
    {
      title: "التكاملات",
      description: "أضف وأدر التطبيقات والخدمات الخارجية التي تتصل بأرشيفك"
    },
    {
      title: "النسخة الاحتياطية والاستعادة",
      description: "إنشاء نسخ احتياطية من بيانات الأرشيف واستعادتها عند الحاجة"
    }
  ],
  collections: [
    {
      title: "المجموعات",
      description: "نظم السجلات في مجموعات حسب الموضوع أو المشروع",
      icon: "Folder"
    },
    {
      title: "إنشاء مجموعة جديدة",
      description: "انقر على 'مجموعة جديدة' لإنشاء مساحة تنظيم منفصلة"
    },
    {
      title: "المشاركة بين الفريق",
      description: "شارك المجموعات مع أعضاء الفريق بمستويات وصول مختلفة"
    },
    {
      title: "الأرشفة",
      description: "أرشف المجموعات القديمة للحفاظ على قائمة عملك نظيفة"
    }
  ]
};

const TIPS_DISMISSED_KEY = "masar.tipsDismissed";

function getDismissedTips(): Set<PageKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(TIPS_DISMISSED_KEY);
    return new Set((stored ? JSON.parse(stored) : []) as PageKey[]);
  } catch {
    return new Set();
  }
}

function setDismissedTips(dismissed: Set<PageKey>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIPS_DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Silent fail on storage errors
  }
}

export function isTipsDismissed(page: PageKey): boolean {
  return getDismissedTips().has(page);
}

export function dismissTips(page: PageKey): void {
  const dismissed = getDismissedTips();
  dismissed.add(page);
  setDismissedTips(dismissed);
}

export function showTipsForPage(page: PageKey): void {
  const dismissed = getDismissedTips();
  dismissed.delete(page);
  setDismissedTips(dismissed);
}

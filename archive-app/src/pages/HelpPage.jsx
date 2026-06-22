import {
  parseAppRoute,
  writeAppRoute
} from "../services/router/index.js";
import { PAGE_MANIFEST } from "../app/pageManifest.js";
import {
  useAppStore,
  useAuthStore
} from "../stores/index.js";
import {
  ArrowUp,
  Bell,
  BookOpen,
  ChartColumn,
  CircleQuestionMark,
  Database,
  FolderOpen,
  HardDrive,
  History,
  Keyboard,
  LayoutGrid,
  Lightbulb,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
  Tag,
  Tags,
  Upload,
  Users,
  Video
} from "lucide-react";
import * as React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import {
  HELP_FAQ_ITEMS,
  HELP_QUICK_SECTION_LINKS
} from "../features/help/content.js";
import {
  createHelpShortcutList,
  createHelpContextCards,
  filterHelpContextCards,
  filterHelpFaqItems,
  filterHelpSections,
  normalizeHelpSectionId
} from "../features/help/viewModel.js";
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_DISABLED,
  getEffectiveKeyboardShortcuts
} from "../features/settings/keyboardShortcuts.js";
import {
  MotionPage,
  PageHero,
  StatusBadge
} from "../components/ui/index.js";
import { RoleSelectionStep } from "../components/onboarding/RoleSelectionStep.jsx";
import {
  formatNumber
} from "../utils/formatting.js";
import {
  normalizeRoleProfileId,
  resolveRoleProfileId
} from "../features/onboarding/roleProfiles.js";

function HelpPanel({ title, children, icon = null, className = "" }) {
  return jsxs("section", {
    className: `va-card p-5 text-right ${className}`,
    dir: "rtl",
    children: [
      jsxs("h3", {
        className: "va-title-section mb-3 flex items-center gap-2",
        children: [
          icon,
          title
        ]
      }),
      children
    ]
  });
}

function HelpText({ children }) {
  return jsx("p", {
    className: "va-bidi-text va-body",
    dir: "rtl",
    children
  });
}

function helpChipButtonClass(isActive) {
  return `va-chip-button ${isActive ? "va-chip-button-active" : ""}`;
}

function InfoGrid({ items }) {
  return jsx("div", {
    className: "grid gap-3 sm:grid-cols-2",
    children: items.map(([title, description]) => jsxs("div", {
      className: "va-card-subtle rounded-lg p-3",
      children: [
        jsx("h4", { className: "va-label va-accent-text mb-1", children: title }),
        jsx("p", { className: "va-bidi-text va-body va-muted", dir: "rtl", children: description })
      ]
    }, title))
  });
}

function NumberedList({ items }) {
  return jsx("ol", {
    className: "va-rtl-list va-numbered-list va-body va-muted space-y-2",
    children: items.map((item) => jsx("li", { children: item }, item))
  });
}

function BulletList({ items }) {
  return jsx("ul", {
    className: "va-rtl-list va-bullet-list va-body va-muted space-y-1.5",
    children: items.map((item) => jsx("li", { children: item }, item))
  });
}

function createHelpSections(keyboardShortcuts, { roleProfile, onRoleProfileChange, onOpenPage } = {}) {
  return [
    {
      id: "guided-journey",
      title: "المسار الموجّه",
      icon: jsx(Users, { className: "h-4 w-4" }),
      searchText: "مسار موجه دور مسؤول محرر مشاهد تخصيص الواجهة",
      content: jsx(RoleSelectionStep, {
        compact: true,
        value: roleProfile,
        onChange: onRoleProfileChange,
        onOpenPage
      })
    },
    {
      id: "getting-started",
      title: "البدء",
      icon: jsx(BookOpen, { className: "h-4 w-4" }),
      searchText: "تشغيل أول استخدام مدير حماية مركز التحكم",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "أرشيف الفيديو محطة عمل أرشيف إعلامي: تجمع البحث، التفريغ، التوصيف، المونتاج، والمشاركة في مسار واحد. ابدأ بالحماية، ثم أنشئ أنواع المحتوى، وبعدها أضف العناصر أو استوردها." }),
          jsx("div", { className: "va-card-subtle mt-4 rounded-xl p-4", children: jsxs(Fragment, {
            children: [
              jsxs("h4", { className: "va-label mb-2 flex items-center gap-2", children: [jsx(Lightbulb, { className: "h-4 w-4 text-amber-400" }), "خطوات البدء السريع"] }),
              jsx(NumberedList, { items: [
                "عيّن كلمة المرور الرئيسية أو اختر البدء السريع بوعي.",
                "استعرض مركز التحكم لمعرفة جاهزية النظام.",
                "أضف أول نوع محتوى أو استخدم الأنواع الحالية.",
                "أضف فيديو أو استورد ملفات من جهازك.",
                "أنشئ نسخة احتياطية قبل نقل البيانات."
              ] })
            ]
          }) })
        ]
      })
    },
    {
      id: "product-workstation",
      title: "محطة العمل الإعلامية",
      icon: jsx(Sparkles, { className: "h-4 w-4" }),
      searchText: "محطة عمل أرشيف إعلامي تفريغ مونتاج مشاركة CLOUD-MediaDB",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "الفكرة العملية: كل ملف خام يصبح مادة قابلة للبحث، التعليق، التفريغ، القص، المشاركة، والتصدير. لذلك لا تبدأ الصفحة من عرض تسويقي؛ تبدأ من العمل اليومي نفسه." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["بحث وتفريغ", "اعثر على المادة من العنوان أو الوسوم أو نص التفريغ، ثم اقفز إلى المقطع المطلوب."],
            ["توصيف موحّد", "الأنواع والحقول والقاموس والوسوم تمنع اختلاف الكتابة بين أعضاء الفريق."],
            ["مونتاج وتصدير", "المشاريع والـ rough cuts تخرج JSON/EDL/MP4 حسب البيئة المتاحة."],
            ["مشاركة آمنة", "المشاركة scoped ومركز البيانات ينقلان ما يلزم دون كشف أسرار أو كلمات مرور."]
          ] }) }),
          jsx("p", { className: "va-bidi-text va-body va-muted mt-4", dir: "rtl", children: "CLOUD-MediaDB مرجع لتجربة المنتج واللغة اليومية فقط. البنية المعتمدة هنا تبقى منافذ @archive/core مع archive-server، وليست server.ts أحادياً أو Firestore داخل الواجهة." })
        ]
      })
    },
    {
      id: "dashboard-archive",
      title: "مركز التحكم والأرشيف",
      icon: jsx(LayoutGrid, { className: "h-4 w-4" }),
      searchText: "أرشيف فلاتر معاينة بطاقات إضافة فيديو",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "مركز التحكم هو بداية الاستخدام اليومي، أما الأرشيف فهو مساحة العمل للفلاتر والمعاينة والتحديد المتعدد." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["زر إنشاء سريع", "يفتح إنشاء مادة أو كيان داعم من أي صفحة حسب الصلاحية والسياق."],
            ["الفلاتر الحية", "البحث والنوع والفرع والمفضلة والمحذوفة تحفظ في الرابط."],
            ["المعاينة", "يمكن مراجعة تفاصيل العنصر دون فقد سياق التصفح."],
            ["التحديد المتعدد", "استخدمه للحذف أو الوسوم أو التصدير على عدة عناصر."]
          ] }) })
        ]
      })
    },
    {
      id: "content-types",
      title: "أنواع المحتوى",
      icon: jsx(Tags, { className: "h-4 w-4" }),
      searchText: "حقول فروع radio checkbox أنواع",
      content: jsx(InfoGrid, { items: [
        ["الأنواع والفروع", "قسّم الأرشيف إلى أفلام، برامج، وثائقيات، أو أي بنية تناسبك."],
        ["الحقول المخصصة", "أضف نصوصاً وقوائم وتواريخ وأرقاماً ووسوماً حسب النوع."],
        ["الاختيارات", "خيارات radio وcheckbox تظهر كصفوف قابلة للنقر ومناسبة لـ RTL."],
        ["الأيقونات والأغلفة", "يمكن استخدام أيقونات مدمجة أو رموز ونصوص وروابط خارجية حسب الإعدادات."]
      ] })
    },
    {
      id: "adding-videos",
      title: "إضافة الفيديوهات",
      icon: jsx(Video, { className: "h-4 w-4" }),
      searchText: "نموذج إضافة تعديل حفظ وسوم حقول",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "اختر نوع المحتوى أولاً، ثم املأ البيانات الأساسية والحقول الديناميكية. استخدم الوسوم والقاموس لتوحيد الإدخال." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["حفظ وعودة", "استخدمه عند إنهاء إدخال عنصر واحد والرجوع للأرشيف."],
            ["حفظ وإضافة آخر", "مناسب للإدخال المتكرر اليومي."],
            ["استدعاء @", "يعرض مصطلحات القاموس داخل حقول النص."],
            ["استدعاء #", "يعرض الوسوم الهرمية والوسوم المستخدمة سابقاً."]
          ] }) })
        ]
      })
    },
    {
      id: "searching",
      title: "البحث",
      icon: jsx(Search, { className: "h-4 w-4" }),
      searchText: "بحث متقدم فلاتر نتائج",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "استخدم البحث للعثور على العناصر بالعنوان أو الوسوم أو الملاحظات أو الحقول المخصصة." }),
          jsx("div", { className: "mt-4", children: jsx(BulletList, { items: [
            "اكتب جزءاً من الكلمة للوصول السريع.",
            "استخدم الفلاتر لتقليل النتائج.",
            "احفظ الرابط إذا أردت الرجوع لنفس الفلترة.",
            "استخدم الاختصار الحالي للبحث من نافذة الاختصارات."
          ] }) })
        ]
      })
    },
    {
      id: "collections",
      title: "المجموعات",
      icon: jsx(FolderOpen, { className: "h-4 w-4" }),
      searchText: "مجموعات ذكية يدوية",
      content: jsx(InfoGrid, { items: [
        ["مجموعات يدوية", "اجمع عناصر مرتبطة بمشروع أو برنامج أو قائمة مراجعة."],
        ["مجموعات ذكية", "يمكن بناؤها لاحقاً على شروط مثل النوع أو الوسوم."],
        ["الأغلفة", "تدعم المجموعات حقول غلاف ومصدر مثل الأنواع."],
        ["عدم التكرار", "العنصر يمكن أن يظهر في عدة مجموعات دون نسخه."]
      ] })
    },
    {
      id: "tags",
      title: "الوسوم",
      icon: jsx(Tag, { className: "h-4 w-4" }),
      searchText: "وسوم هرمية #",
      content: jsx(InfoGrid, { items: [
        ["وسوم عادية", "تُضاف مباشرة إلى الفيديو لتسهيل البحث."],
        ["وسوم هرمية", "تظهر بمسار كامل مثل الأصل / الفرع عند الاختيار."],
        ["استدعاء #", "يفتح قائمة الوسوم الهرمية والوسوم المستخدمة سابقاً."],
        ["منع التكرار", "الاختيار من الاقتراحات يقلل اختلاف الكتابة."]
      ] })
    },
    {
      id: "vocabulary-autocomplete",
      title: "القاموس و @/#",
      icon: jsx(BookOpen, { className: "h-4 w-4" }),
      searchText: "قاموس مصطلحات @ autocomplete",
      content: jsx(InfoGrid, { items: [
        ["مصطلحات القاموس", "اكتب @ داخل النص لاستدعاء مصطلح موحد."],
        ["الوسوم", "اكتب # لاستدعاء وسم أو مسار هرمي."],
        ["تخصيص الرموز", "يمكن تغيير رمزي @ و# من الإعدادات مع منع التعارض."],
        ["دعم RTL", "الرموز التقنية تبقى LTR محلياً دون قلب اتجاه الفقرة."]
      ] })
    },
    {
      id: "file-import",
      title: "استيراد الملفات",
      icon: jsx(Upload, { className: "h-4 w-4" }),
      searchText: "استيراد ملفات مجلد روابط",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "استيراد الملفات يساعدك على إنشاء عناصر من مجموعة فيديوهات. قبل العمليات الكبيرة، استخدم المعاينة والنسخ الاحتياطي." }),
          jsx("div", { className: "mt-4", children: jsx(NumberedList, { items: [
            "افتح الأرشيف ثم استيراد ملفات.",
            "اختر الملفات أو المجلد.",
            "راجع الملخص وحدد النوع أو الفرع.",
            "أنشئ العناصر بعد التأكد من المعاينة."
          ] }) })
        ]
      })
    },
    {
      id: "backup-import",
      title: "النسخ الاحتياطي والاستيراد",
      icon: jsx(Database, { className: "h-4 w-4" }),
      searchText: "نسخ احتياطي استيراد Excel JSON rollback checksum",
      content: jsx(InfoGrid, { items: [
        ["JSON للنقل", "الخيار الموصى به بين الأجهزة مع checksum وملخص محتوى."],
        ["Excel صادر من التطبيق", "يدعم الاستيراد فقط إذا احتوى ورقة payload المخفية."],
        ["دمج آمن", "الوضع الافتراضي عند الاستيراد لتقليل خطر فقد البيانات."],
        ["Rollback", "عند فشل الكتابة لا تُطبق البيانات التالفة على الأرشيف الحالي."]
      ] })
    },
    {
      id: "transfer-export",
      title: "النقل بين الأجهزة",
      icon: jsx(HardDrive, { className: "h-4 w-4" }),
      searchText: "نقل جهاز آخر checksum دمج استبدال",
      content: jsx(InfoGrid, { items: [
        ["قبل النقل", "أنشئ نسخة احتياطية وتأكد من آخر فحص نظام."],
        ["ملف النقل", "يحتوي checksum وملخصاً ولا يتضمن كلمات المرور."],
        ["الدمج", "يناسب نقل بيانات إلى جهاز يحتوي بيانات سابقة."],
        ["الاستبدال", "متاح بتحذير واضح وتأكيد صريح."]
      ] })
    },
    {
      id: "troubleshooting",
      title: "حل المشاكل",
      icon: jsx(Shield, { className: "h-4 w-4" }),
      searchText: "خطأ تحذير فشل تخزين IndexedDB SQLite",
      content: jsx(InfoGrid, { items: [
        ["IndexedDB غير متاح", "تأكد أن المتصفح لا يمنع التخزين المحلي ثم أعد تشغيل التطبيق."],
        ["SQLite", "غير مفعّل في هذه النسخة. التخزين المحلي يعمل عبر IndexedDB ويمكن متابعة العمل طبيعيًا."],
        ["فشل الاستيراد", "راجع checksum ونوع الملف. الملفات الخارجية العادية لا تُستورد كبيانات v1."],
        ["رسائل الخطأ", "تعرض ماذا حدث، هل تم التراجع، وما الإجراء التالي."]
      ] })
    },
    {
      id: "reports-settings",
      title: "التقارير والتخصيص",
      icon: jsx(ChartColumn, { className: "h-4 w-4" }),
      searchText: "تقارير إعدادات ثيم ألوان كثافة",
      content: jsx(InfoGrid, { items: [
        ["التقارير", "تعرض ملخصات النشاط والتوزيع حسب الأنواع والسجلات."],
        ["الثيم", "يدعم Ink Slate للوضع الليلي وWarm Off-white للوضع النهاري."],
        ["لون accent", "الفيروزي افتراضي مع دعم النيلي وخيارات أخرى."],
        ["كثافة الواجهة", "تساعد على الموازنة بين الراحة وكثافة البيانات."]
      ] })
    },
    {
      id: "users",
      title: "المستخدمون والصلاحيات",
      icon: jsx(Users, { className: "h-4 w-4" }),
      searchText: "مستخدمون أدوار صلاحيات مدير محرر مشاهد",
      content: jsx(InfoGrid, { items: [
        ["مدير", "صلاحيات كاملة للإعدادات والبيانات والمستخدمين."],
        ["محرر", "إضافة وتعديل وإدارة المحتوى اليومي."],
        ["مشاهد", "عرض وبحث دون تعديل."],
        ["كلمات المرور", "لا تدخل في ملفات النقل أو Excel."]
      ] })
    },
    {
      id: "notifications-guide",
      title: "الإشعارات والرسائل",
      icon: jsx(Bell, { className: "h-4 w-4" }),
      searchText: "إشعارات رسائل أخطاء تأكيد",
      content: jsx(InfoGrid, { items: [
        ["مركز الرسائل", "يجمع الأخطاء والتحذيرات والتنبيهات الأخيرة."],
        ["التأكيد", "العمليات الحساسة تعرض تأكيداً واضحاً قبل التطبيق."],
        ["RTL", "الرسائل والقوائم تعرض باتجاه عربي مع عزل الرموز التقنية."],
        ["الإجراء التالي", "رسائل الخطأ تقترح خطوة عملية بدل الاكتفاء بوصف المشكلة."]
      ] })
    },
    {
      id: "navigation-links",
      title: "التنقل والروابط",
      icon: jsx(History, { className: "h-4 w-4" }),
      searchText: "History API hash روابط back forward",
      content: jsx(InfoGrid, { items: [
        ["Hash routing", "يعمل عند فتح التطبيق من file:// مثل #/archive."],
        ["History API", "متاح عند التشغيل من سيرفر محلي للروابط النظيفة."],
        ["حالة الفلاتر", "تُحفظ في الرابط وتستعاد عند الرجوع."],
        ["روابط المساعدة", "مثل #/help?section=shortcuts أو #/help?section=troubleshooting."]
      ] })
    },
    {
      id: "storage-setup",
      title: "إعداد التخزين",
      icon: jsx(HardDrive, { className: "h-4 w-4" }),
      searchText: "تخزين قاعدة بيانات postgres pocketbase firebase محلي خادم",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "عند البدء الأول يمكنك اختيار مكان حفظ البيانات. يمكن تغيير هذا الإعداد لاحقاً من الإعدادات ← التخزين." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["SQL على الخادم", "موصى به. مصدر حقيقة مركزي عبر archive-server مع مراقبة صحة قاعدة البيانات."],
            ["محلي مستقل", "أوفلاين على هذا الجهاز فقط. مناسب للتجربة أو العمل المنفصل."],
            ["خادم PocketBase", "بديل أخفّ — خادم واحد بملف SQLite وواجهة إدارة مدمجة."],
            ["Firebase", "Firestore/Auth/Storage من جانب العميل؛ مناسب للنشر السريع دون خادم مملوك."]
          ] }) })
        ]
      })
    },
    {
      id: "security-guide",
      title: "الحماية والأمان",
      icon: jsx(Shield, { className: "h-4 w-4" }),
      searchText: "حماية أمان كلمة مرور مدير jwt توكن جلسة",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "يدعم التطبيق وضعَي حماية: الإعداد الآمن (موصى به) والبدء السريع للتجربة المحلية." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["الإعداد الآمن", "يطلب كلمة مرور المدير ويحفظ JWT بشكل مشفّر — مناسب للاستخدام الفعلي."],
            ["البدء السريع", "يطبّق إعدادات افتراضية بلا كلمة مرور — للتجربة المحلية فقط."],
            ["تغيير كلمة المرور", "متاح دائماً من الإعدادات ← الأمان ← تغيير كلمة المرور."],
            ["انتهاء الجلسة", "تنتهي الجلسة تلقائياً وفق مدة JWT المحدّدة في إعدادات الخادم."]
          ] }) })
        ]
      })
    },
    {
      id: "interface-guide",
      title: "الواجهة والشريط الجانبي",
      icon: jsx(LayoutGrid, { className: "h-4 w-4" }),
      searchText: "واجهة شريط جانبي سياق تحكم بيانات تنقل صفحات",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "الواجهة مقسّمة إلى أربعة محاور رئيسية تصل منها إلى كل وظائف التطبيق." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["الشريط الجانبي", "مرتكز يمينًا للوصول السريع إلى الشاشات الأساسية: الأرشيف والمشاريع والتقارير."],
            ["شريط السياق", "يعرض عنوان الصفحة ومسارها والإجراء الأساسي وزر المساعدة السياقية."],
            ["مركز التحكم", "بداية يومية — جاهزية النظام، إضافة مادة سريعة، بحث، ونقل."],
            ["مركز البيانات", "تصدير النسخ الاحتياطية، استيراد ملفات، وملفات النقل بين الأجهزة."]
          ] }) })
        ]
      })
    },
    {
      id: "appearance-guide",
      title: "المظهر والثيم",
      icon: jsx(Sparkles, { className: "h-4 w-4" }),
      searchText: "مظهر ثيم لون فاتح داكن نهاري ليلي accent فيروزي نيلي",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "يمكن تغيير مظهر التطبيق في أي وقت من الإعدادات ← المظهر. التغيير فوري بلا إعادة تحميل." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["ليلي حبري (Ink Slate)", "وضع داكن مريح للفهرسة الطويلة في بيئات خافتة الإضاءة."],
            ["نهاري دافئ (Warm Off-white)", "وضع فاتح لتقليل إجهاد العين في الضوء الطبيعي."],
            ["حسب النظام", "يتبع إعداد المتصفح أو نظام التشغيل تلقائيًا."],
            ["لون التفاعل (accent)", "الفيروزي افتراضي، والنيلي بديل — يؤثر على الأزرار والتأكيدات والروابط."]
          ] }) })
        ]
      })
    },
    {
      id: "data-guide",
      title: "البيانات والنقل",
      icon: jsx(Database, { className: "h-4 w-4" }),
      searchText: "بيانات نسخ احتياطي استيراد نقل أجهزة json excel checksum سجل",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "مركز البيانات يجمع أدوات حفظ البيانات ونقلها. تجده في الشريط الجانبي أو عبر Ctrl+K ← 'مركز البيانات'." }),
          jsx("div", { className: "mt-4", children: jsx(InfoGrid, { items: [
            ["النسخ الاحتياطي", "صدّر كل أرشيفك كملف JSON يمكن استعادته لاحقاً بنقرة واحدة."],
            ["الاستيراد", "ادمج نسخة احتياطية سابقة أو استورد بيانات من ملف Excel."],
            ["النقل بين الأجهزة", "أنشئ ملف نقل مع checksum للتحقق عند استعادته على جهاز آخر."],
            ["سجل العمليات", "تتبع من غيّر ماذا ومتى — كل عملية مسجّلة بالمستخدم والتوقيت."]
          ] }) })
        ]
      })
    },
    {
      id: "shortcuts",
      title: "اختصارات لوحة المفاتيح",
      icon: jsx(Keyboard, { className: "h-4 w-4" }),
      searchText: "اختصارات Ctrl لوحة مفاتيح",
      content: jsxs(Fragment, {
        children: [
          jsx(HelpText, { children: "هذه القائمة تعرض الاختصارات الفعلية من إعداداتك الحالية، بما في ذلك الاختصارات المعطلة." }),
          jsx("div", {
            className: "mt-4 space-y-2",
            children: keyboardShortcuts.map((shortcut) => jsxs("div", {
              className: "va-card-subtle flex items-center justify-between gap-3 rounded-lg p-3",
              children: [
                jsxs("span", {
                  className: "min-w-0",
                  children: [
                    jsx("span", { className: "va-body block", children: shortcut.description }),
                    jsx("span", { className: "va-label va-faint block", children: shortcut.category })
                  ]
                }),
                jsx("div", {
                  className: "va-shortcut-sequence flex items-center gap-1",
                  dir: "ltr",
                  children: shortcut.keys.map((key, index) => jsxs("span", {
                    children: [
                      jsx("kbd", {
                        className: `va-mixed-token rounded px-2 py-1 font-mono text-xs ${shortcut.disabled ? "border border-amber-500/20 bg-amber-500/10 text-amber-300" : "va-kbd-token"}`,
                        children: key
                      }),
                      !shortcut.disabled && index < shortcut.keys.length - 1 && jsx("span", { className: "va-faint mx-1", children: "+" })
                    ]
                  }, `${shortcut.id}-${key}-${index}`))
                })
              ]
            }, shortcut.id))
          })
        ]
      })
    }
  ];
}

export function HelpPage() {
  const { settings, updateSettings, setCurrentPage } = useAppStore();
  const { currentUser } = useAuthStore();
  const [activeSection, setActiveSection] = React.useState(settings.ui?.lastHelpSection || "getting-started");
  const [helpQuery, setHelpQuery] = React.useState("");
  const contentRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      // Focus the search input when "/" is pressed (GitHub-style),
      // unless the user is already typing in a field.
      if (event.key !== "/") return;
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
  const effectiveShortcuts = getEffectiveKeyboardShortcuts(settings);
  const keyboardShortcuts = createHelpShortcutList(SHORTCUT_ACTIONS, effectiveShortcuts, SHORTCUT_DISABLED);
  const roleProfile = normalizeRoleProfileId(resolveRoleProfileId({ settings, currentUser }));
  const onRoleProfileChange = React.useCallback((value) => {
    updateSettings({ ui: { ...(settings.ui || {}), roleProfile: normalizeRoleProfileId(value) } });
  }, [settings.ui, updateSettings]);
  const openRolePage = React.useCallback((page) => {
    setCurrentPage?.(page);
  }, [setCurrentPage]);
  const sections = React.useMemo(() => createHelpSections(keyboardShortcuts, {
    roleProfile,
    onRoleProfileChange,
    onOpenPage: openRolePage
  }), [keyboardShortcuts, onRoleProfileChange, openRolePage, roleProfile]);
  const filteredSections = React.useMemo(() => filterHelpSections(sections, helpQuery), [sections, helpQuery]);
  const filteredFaqItems = React.useMemo(() => filterHelpFaqItems(HELP_FAQ_ITEMS, helpQuery), [helpQuery]);
  const contextCards = React.useMemo(() => createHelpContextCards(PAGE_MANIFEST), []);
  const filteredContextCards = React.useMemo(() => filterHelpContextCards(contextCards, helpQuery), [contextCards, helpQuery]);
  const visibleContextCards = helpQuery.trim() ? filteredContextCards : filteredContextCards.slice(0, 8);

  const scrollToSection = React.useCallback((sectionId, options = {}) => {
    const normalizedSectionId = normalizeHelpSectionId(sectionId);
    setActiveSection(normalizedSectionId);
    updateSettings({ ui: { ...(settings.ui || {}), lastHelpSection: normalizedSectionId } });
    if (!options.skipRoute) {
      writeAppRoute("help", { section: normalizedSectionId }, settings, false);
    }
    const el = document.getElementById(`section-${normalizedSectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [settings, updateSettings]);

  React.useEffect(() => {
    const applyHelpSectionFromRoute = () => {
      const route = parseAppRoute();
      if (route.page !== "help") return;
      const sectionId = normalizeHelpSectionId(route.section || settings.ui?.lastHelpSection || "getting-started");
      setActiveSection(sectionId);
      window.requestAnimationFrame?.(() => {
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    applyHelpSectionFromRoute();
    window.addEventListener("popstate", applyHelpSectionFromRoute);
    window.addEventListener("hashchange", applyHelpSectionFromRoute);
    return () => {
      window.removeEventListener("popstate", applyHelpSectionFromRoute);
      window.removeEventListener("hashchange", applyHelpSectionFromRoute);
    };
  }, [settings.ui?.lastHelpSection]);

  const restartV1Tour = () => {
    updateSettings({ ui: { ...(settings.ui || {}), v1TourCompleted: false, v1TourVersion: null, lastOnboardingStep: "tour-restart" } });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("videoarchive:onboarding-open", { detail: { mode: "replay" } }));
    }
  };

  // §1152: start the interactive feature-discovery tour. The controller mounted
  // in AppNotifications listens for this event and opens the tour, replaying it
  // from the start regardless of previous dismissal.
  const startGuidedTour = () => {
    updateSettings({ ui: { ...(settings.ui || {}), tourDismissed: false, tourSeenSteps: [] } });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("videoarchive:start-guided-tour"));
    }
  };

  return jsxs(MotionPage, {
    className: "help-page flex h-[calc(100vh-4rem)] gap-6 p-4 text-right sm:p-6",
    role: "main",
    "aria-label": "المساعدة والدليل",
    children: [
      jsx("aside", {
        className: "hidden w-56 shrink-0 lg:block",
        children: jsxs("div", {
          className: "va-tab-surface sticky top-6 rounded-2xl backdrop-blur-sm",
          children: [
            jsxs("div", {
              className: "va-border-bottom-soft va-label flex items-center gap-2 p-4",
              children: [jsx(BookOpen, { className: "va-accent-text h-4 w-4" }), "فهرس المحتوى"]
            }),
            jsxs("nav", {
              className: "space-y-1 p-2",
              "aria-label": "فهرس المساعدة",
              children: [
                filteredSections.map((section) => jsxs("button", {
                  type: "button",
                  onClick: () => scrollToSection(section.id),
                  className: `${helpChipButtonClass(activeSection === section.id)} flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm`,
                  "aria-current": activeSection === section.id ? "true" : void 0,
                  children: [section.icon, section.title]
                }, section.id)),
                jsx("div", { className: "my-2 h-px va-surface-muted" }),
                jsxs("button", {
                  type: "button",
                  onClick: () => scrollToSection("faq"),
                  className: `${helpChipButtonClass(activeSection === "faq")} flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm`,
                  children: [jsx(MessageCircle, { className: "h-4 w-4" }), "أسئلة شائعة"]
                })
              ]
            })
          ]
        })
      }),
      jsxs("div", {
        className: "min-w-0 flex-1",
        children: [
          jsx(PageHero, {
            className: "mb-6",
            icon: jsx(CircleQuestionMark, { className: "va-accent-text h-6 w-6" }),
            title: "المساعدة والدليل",
            description: "مركز معرفة قابل للبحث، بروابط مباشرة للأقسام، ومصمم ليعطي المستخدم إجابة عملية بدون مغادرة السياق.",
            actions: jsxs(Fragment, {
              children: [
                jsxs("button", {
                  type: "button",
                  onClick: startGuidedTour,
                  className: "btn btn-ghost gap-2",
                  children: [jsx(Lightbulb, { className: "h-4 w-4 text-amber-300" }), "ابدأ الجولة"]
                }),
                jsxs("button", {
                  type: "button",
                  onClick: restartV1Tour,
                  className: "btn btn-ghost gap-2",
                  children: [jsx(Sparkles, { className: "h-4 w-4 text-amber-300" }), "إعادة الجولة"]
                }),
                jsxs("button", {
                  type: "button",
                  onClick: () => setCurrentPage?.("settings"),
                  className: "btn btn-primary gap-2",
                  children: [jsx(Shield, { className: "h-4 w-4" }), "الإعدادات"]
                })
              ]
            }),
            children: jsxs("div", {
              className: "mt-5 space-y-4",
              children: [
                jsxs("div", {
                  className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]",
                  children: [
                    jsxs("div", {
                      className: "relative",
                      role: "search",
                      children: [
                        jsx(Search, { className: "va-faint absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" }),
                        jsx("input", {
                          ref: searchInputRef,
                          value: helpQuery,
                          onChange: (event) => setHelpQuery(event.target.value),
                          placeholder: "ابحث في المساعدة، الاستيراد، النسخ الاحتياطي... (اضغط / للتركيز)",
                          dir: "auto",
                          "aria-label": "بحث في المساعدة",
                          className: "va-bidi-input va-body w-full va-surface-deep rounded-xl border py-3 pl-3 pr-10 outline-none"
                        })
                      ]
                    }),
                    jsxs("div", {
                      className: "flex flex-wrap items-center gap-2",
                      children: [
                        jsx(StatusBadge, { tone: "emerald", children: `${formatNumber(filteredSections.length)} قسم` }),
                        jsx(StatusBadge, { tone: "amber", children: `${formatNumber(filteredContextCards.length)} تلميح` }),
                        jsx(StatusBadge, { tone: "slate", children: `${formatNumber(keyboardShortcuts.length)} اختصار` })
                      ]
                    })
                  ]
                }),
                jsx("div", {
                  className: "flex flex-wrap gap-2",
                  children: HELP_QUICK_SECTION_LINKS.map(([sectionId, label]) => jsx("button", {
                    type: "button",
                    onClick: () => scrollToSection(sectionId),
                    className: `${helpChipButtonClass(activeSection === sectionId)} rounded-xl px-3 py-2 text-sm`,
                    children: label
                  }, sectionId))
                })
              ]
            })
          }),
          jsx("div", {
            className: "mb-4 lg:hidden",
            children: jsx("div", {
              className: "va-tab-surface rounded-xl p-3",
              children: jsx("div", {
                className: "flex flex-wrap gap-2",
                children: filteredSections.map((section) => jsxs("button", {
                  type: "button",
                  onClick: () => scrollToSection(section.id),
                  className: `${helpChipButtonClass(activeSection === section.id)} flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs`,
                  children: [section.icon, section.title]
                }, section.id))
              })
            })
          }),
          jsx("section", {
            className: "mb-6 space-y-3",
            dir: "rtl",
            "aria-labelledby": "help-context-title",
            children: jsxs(Fragment, {
              children: [
                jsxs("div", {
                  className: "flex flex-wrap items-center justify-between gap-3",
                  children: [
                    jsxs("h2", {
                      id: "help-context-title",
                      className: "va-title-section flex items-center gap-2",
                      children: [jsx(Lightbulb, { className: "h-4 w-4 text-amber-400" }), "تلميحات سياقية حسب الصفحة"]
                    }),
                    jsx(StatusBadge, { tone: "slate", children: `${formatNumber(visibleContextCards.length)} معروض` })
                  ]
                }),
                visibleContextCards.length === 0 ? jsx("p", {
                  className: "va-card-subtle va-body rounded-xl p-4 text-center",
                  children: "لا توجد تلميحات صفحات مطابقة للبحث الحالي."
                }) : jsx("div", {
                  className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4",
                  children: visibleContextCards.map((card) => jsxs("button", {
                    type: "button",
                    onClick: () => scrollToSection(card.helpSection),
                    className: "va-card-subtle group min-h-32 rounded-xl p-4 text-right transition-colors hover:border-[var(--va-action)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    children: [
                      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                        jsxs("span", { className: "min-w-0", children: [
                          jsx("span", { className: "va-label block truncate text-[var(--va-text)]", children: card.title }),
                          jsx("span", { className: "va-faint mt-1 block truncate text-xs", children: card.breadcrumb })
                        ] }),
                        jsx("span", { className: "rounded-lg border border-[var(--va-border-soft)] px-2 py-1 text-[10px] va-faint", children: card.heavy ? "متقدم" : card.group })
                      ] }),
                      jsx("p", { className: "va-bidi-text va-body va-muted mt-3 line-clamp-3", dir: "rtl", children: card.hint }),
                      jsx("span", { className: "va-label va-accent-text mt-3 inline-flex", children: "افتح القسم المرتبط" })
                    ]
                  }, card.id))
                })
              ]
            })
          }),
          jsx("div", {
            ref: contentRef,
            className: "h-[calc(100vh-18rem)] overflow-y-auto pr-1",
            children: jsxs("div", {
              className: "space-y-6 pb-4",
              children: [
                filteredSections.length === 0 && jsx("div", {
                  className: "va-card-subtle va-body rounded-xl p-6 text-center",
                  children: "لا توجد أقسام مطابقة. جرّب كلمة أبسط أو افتح الأسئلة الشائعة."
                }),
                filteredSections.map((section) => jsx("div", {
                  id: `section-${section.id}`,
                  children: jsx(HelpPanel, { title: section.title, icon: section.icon, children: section.content })
                }, section.id)),
                jsx("div", {
                  id: "section-faq",
                  children: jsx(HelpPanel, {
                    title: "الأسئلة الشائعة",
                    icon: jsx(MessageCircle, { className: "va-accent-text h-5 w-5" }),
                    children: jsx("div", {
                      className: "space-y-4",
                      children: filteredFaqItems.length === 0 ? jsx("p", {
                        className: "va-body va-faint py-6 text-center",
                        children: "لا توجد أسئلة مطابقة للبحث الحالي"
                      }) : filteredFaqItems.map((faq, index) => jsxs("div", {
                        className: "va-card-subtle rounded-xl p-4",
                        children: [
                          jsxs("h4", {
                            className: "va-label flex items-center gap-2",
                            children: [
                              jsx(CircleQuestionMark, { className: "va-accent-text h-4 w-4 shrink-0" }),
                              jsx("span", { dir: "auto", className: "va-bidi-text", children: faq.question })
                            ]
                          }),
                          jsx("p", {
                            dir: "auto",
                            className: "va-bidi-text va-body va-muted mr-6 mt-2",
                            children: faq.answer
                          })
                        ]
                      }, index))
                    })
                  })
                }),
                jsx("div", {
                  className: "flex justify-center pb-4",
                  children: jsxs("button", {
                    type: "button",
                    onClick: () => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
                    className: "va-chip-button inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm",
                    children: [jsx(ArrowUp, { className: "h-4 w-4" }), "العودة للأعلى"]
                  })
                })
              ]
            })
          })
        ]
      })
    ]
  });
}

HelpPage.pageId = "help";
HelpPage.pageTitle = "المساعدة";
HelpPage.migrationStatus = "native";

export default HelpPage;

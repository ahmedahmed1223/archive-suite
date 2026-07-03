# إغلاق خطة تجربة UI الغنية في Masar

تاريخ التدقيق: 2026-07-03

هذه الوثيقة تغلق خطة "مكتبات وتجربة UI غنية لنظام Masar" مقابل الحالة الفعلية في المسار القانوني `archive-next`. الهدف هنا ليس العودة للتصميم القديم، بل تثبيت واجهة تشغيلية أحدث وأكثر اتساقا مع هوية Masar.

## الحكم التنفيذي

خطة UI الغنية منجزة في `archive-next`: مزودات التطبيق، طبقة `components/ui`، جداول TanStack، نماذج React Hook Form/Zod، تفاعل Kanban، رسوم Recharts، لوحة أوامر cmdk، وlight/dark عبر tokens موحدة. المتبقي أدناه ليس نقصا في خطة الواجهة نفسها، بل أعمال Backend أو تحقق خارجي موثقة في `TASKS.md`.

## مصفوفة الإغلاق

| بند الخطة | الحالة | الدليل الحالي |
|---|---|---|
| الأساس البصري: `next-themes`, `lucide-react`, مزودات عامة، ودعم `data-theme` | منجز | `archive-next/components/AppProviders.tsx`, `archive-next/components/ThemeToggle.tsx`, `archive-next/app/layout.tsx`, `archive-next/app/theme.css`, `archive-next/app/globals.css` |
| مكونات UI محلية مبنية فوق Radix | منجز | `archive-next/components/ui/Button.tsx`, `Dialog.tsx`, `Dropdown.tsx`, `Tabs.tsx`, `Tooltip.tsx`, `Select.tsx`, `Switch.tsx`, `Toast.tsx`, `Drawer.tsx` |
| الجداول والبيانات: TanStack Query/Table/Virtual | منجز | `archive-next/components/ui/DataTable.tsx`, `archive-next/app/archive/page.tsx`, `archive-next/app/files/page.tsx`, `archive-next/app/errors/page.tsx`, `archive-next/app/settings/users/page.tsx`, `archive-next/app/analytics/page.tsx` |
| النماذج: React Hook Form + Zod ورسائل خطأ عربية | منجز | `archive-next/app/types/page.tsx`, `archive-next/app/settings/users/page.tsx`, `archive-next/app/media/jobs/MediaJobsList.tsx`, `archive-next/app/media/jobs/MediaJobLookup.tsx`, `archive-next/components/ui/Form.tsx` |
| التفاعل: dnd-kit + motion | منجز | `archive-next/app/kanban/page.tsx` يستخدم السحب لتغيير حالة السجل عبر `records/bulk` مع fallback اختيار الحالة |
| التحليلات والتنقل السريع: Recharts + cmdk | منجز | `archive-next/app/analytics/page.tsx`, `archive-next/components/CommandPalette.tsx`, `archive-next/components/AppHeader.tsx`, `archive-next/lib/navigation.ts` |
| تكامل الهوية البصرية Masar | منجز | `archive-next/lib/brand.ts`, `archive-next/public/brand/*`, `archive-next/public/favicon.svg`, `archive-next/components/AppHeader.tsx` |
| smoke بصري للصفحات الأساسية | منجز كمنهج إغلاق | المسارات الأساسية: `/`, `/archive`, `/files`, `/types`, `/settings`, `/settings/users`, `/media/jobs`, `/errors`, `/kanban`, `/analytics`, `/help` على desktop/mobile |

## الصفحات التي أصبحت ضمن التصميم المعتمد

- تشغيل يومي: `/`, `/archive`, `/archive/[id]`, `/uploads`, `/search`, `/files`, `/timeline`, `/inbox`, `/favorites`, `/shares`.
- تنظيم وإدارة: `/types`, `/collections`, `/vocabulary`, `/tags`, `/duplicates`, `/kanban`, `/projects`, `/media/jobs`, `/transcriber`, `/collaboration`, `/automation`.
- مراقبة: `/activity`, `/analytics`, `/reports`, `/status`, `/errors`.
- إدارة النظام: `/ingest`, `/backup`, `/rights`, `/settings`, `/settings/users`, `/help`.
- عامة/وسائط: `/media/play`, `/media/compare`, `/media/review`, `/review/[token]`, `/share/[token]`.

## ما تبقى بعد إغلاق خطة UI

هذه العناصر لا تمنع اعتبار خطة UI الغنية منتهية، لكنها تبقى في خطة المنتج العامة:

- تخزين Laravel دائم للكيانات التي بدأت كواجهات تشغيلية محلية: collections, vocabulary, tags, inbox, duplicates, automation rules.
- سجل نشاط عميق مع undo/diffs فوق audit log، وربطه بتفاصيل السجل عند توفر endpoint مخصص.
- Live collaboration عميق على مستوى OT/CRDT وربط أحداث فورية إضافية بصفحات تشغيلية مختارة.
- تحقق خارجي غير متاح محليا: دقة التفريغ العربي على GPU حقيقي، dry-run Kubernetes بسياق فعلي، smoke ODBC على Windows DSN فعلي، وتشغيل Sentry بحساب/DSN إنتاجي.
- تشغيل بوابة live الكاملة `pnpm run verify:laravel-next:live` عند توفر بيئة Docker/متصفح مستقرة للربط الحي الكامل.

## بوابات الإغلاق

تظل بوابات الإغلاق المعتمدة لهذه الدفعة:

- `pnpm run typecheck:next`
- `pnpm run build:next`
- `pnpm run verify:repo-hygiene`
- `git diff --check`
- smoke بصري desktop/mobile للمسارات الأساسية أعلاه


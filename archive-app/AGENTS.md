# AGENTS.md - @archive/app

اتبع تعليمات المستودع الموحد في [`../AGENTS.md`](../AGENTS.md).

## ملاحظات محلية

- اسم الحزمة هو `@archive/app`.
- شغّل أوامر الواجهة من الجذر:

```powershell
pnpm run dev
pnpm run verify:app
pnpm run build:spa
pnpm run build:cloud
```

- لا تلتزم `dist/` أو `dist-cloud/` أو `dist-aistudio/` أو تقارير Playwright.
- عند تعديل `TASKS.md`، عدّل بند المهمة فقط وتجنب إعادة ترتيب واسعة.

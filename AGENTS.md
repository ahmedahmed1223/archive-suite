# AGENTS.md - Archive Suite working rules

هذا الملف هو مرجع العمل للمستودع الموحد `Archive Suite`.

## البنية

- `archive app/` هي واجهة React/Vite واسم حزمتها `@archive/app`.
- `archive-core/` هي النواة المشتركة واسم حزمتها `@archive/core`.
- `archive-server/` هو خادم الإنتاج واسم حزمتها `archive-server`.
- الجذر هو `pnpm` workspace. استخدم `pnpm-lock.yaml` فقط، ولا تضف `package-lock.json`.

## أوامر الجذر

```powershell
pnpm install
pnpm run dev
pnpm run server
pnpm run verify
```

وللتحقق الجزئي:

```powershell
pnpm run verify:app
pnpm run verify:core
pnpm run verify:server
```

## قواعد التغيير

- تغيير واحد منطقي لكل فرع أو جلسة عمل.
- لا تخلط ترتيب المستودع مع ميزات المنتج في نفس التغيير إلا إذا كان ذلك ضروريًا.
- حافظ على منافذ `@archive/core`: أي تخزين أو AI أو ملفات أو مصادقة يجب أن يبقى خلف محول، لا داخل كود الميزات مباشرة.
- لا تلتزم مخرجات البناء أو تقارير Playwright أو ملفات `.env`.
- بعد أي تعديل في الكود، شغل التحقق المناسب من الجذر واذكر ما شغلته.

## ملفات عالية الحساسية

- `pnpm-lock.yaml`: حدّثه عبر `pnpm install` عند تغيير الاعتماديات فقط.
- `archive app/TASKS.md`: أضف أو عدّل بند المهمة فقط، وتجنب إعادة ترتيب واسعة.
- `archive-server/.env.example`: وثّق المتغيرات العامة فقط. لا تنقل أسرارًا من `.env`.

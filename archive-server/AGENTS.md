# AGENTS.md - archive-server

اتبع تعليمات المستودع الموحد في [`../AGENTS.md`](../AGENTS.md).

## ملاحظات محلية

- اسم الحزمة هو `archive-server`.
- أبقِ الخلفيات خلف محولات منافذ `@archive/core`.
- لا تلتزم `.env` أو بيانات PocketBase أو عملاء Prisma المولدين.
- شغّل تحقق الخادم من الجذر:

```powershell
pnpm run verify:server
```

export type SummaryTone = "success" | "warning" | "danger" | "default";

export type ActionSummary = {
  tone: SummaryTone;
  summary: string;
  detail: string;
};

const secretPatterns: Array<[RegExp, string]> = [
  [/("(?:password|passwd|token|secret|api[_-]?key)"\s*:\s*")[^"]*(")/gi, "$1••••$2"],
  [/("Authorization"\s*:\s*")Bearer\s+[^"]*"/gi, "$1Bearer ••••\""],
  [/(\bAuthorization\s*:\s*)Bearer\s+[^\s;,]+/gi, "$1Bearer ••••"],
  [/\bBearer\s+[^\s;,'"]+/gi, "Bearer ••••"],
  [/\b(password|passwd|token|secret|api[_-]?key)\s*=\s*[^\s;,]+/gi, "$1=••••"]
];

export function redactAdminSecrets(value: string) {
  return secretPatterns.reduce((redacted, [pattern, replacement]) => redacted.replace(pattern, replacement), value);
}

export function buildShareExpiry(expiresAt?: string | null, now = new Date()): ActionSummary & { label: string } {
  if (!expiresAt) return { tone: "default", label: "بلا انتهاء", summary: "لا يوجد تاريخ انتهاء معلن", detail: "راجع صلاحية الرابط قبل مشاركته خارج الفريق." };
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return { tone: "warning", label: "تاريخ غير واضح", summary: "تعذر قراءة انتهاء الرابط", detail: "لا تعتمد الرابط حتى تتأكد من تاريخ انتهائه." };
  const remaining = expires.getTime() - now.getTime();
  if (remaining <= 0) return { tone: "danger", label: "منتهية", summary: "انتهت صلاحية الرابط", detail: "أنشئ رابطاً جديداً إذا بقيت الحاجة إلى المشاركة." };
  if (remaining <= 48 * 60 * 60 * 1000) return { tone: "warning", label: "تنتهي قريباً", summary: "صلاحية الرابط قصيرة", detail: "تأكد من أن المستلم سيتمكن من فتحه قبل الانتهاء." };
  return { tone: "success", label: "نشطة", summary: "الرابط ضمن فترة الصلاحية", detail: "تبقى الصلاحيات التي أنشئ بها الرابط هي المطبقة." };
}

export function buildExportPreview({ total, format, limit }: { total: number; format: string; limit: number }): ActionSummary {
  const exported = Math.min(total, limit);
  const capped = total > limit;
  return {
    tone: capped ? "warning" : "default",
    summary: capped ? `سيُصدّر أول ${exported} من ${total} نتيجة مطابقة` : `سيُصدّر ${exported} نتيجة مطابقة`,
    detail: `التنسيق: ${format}. راجع الفلاتر قبل التصدير.`
  };
}

export function buildBackupFreshness(lastBackupAt?: string | string[], now = new Date()): ActionSummary & { label: string } {
  const timestamps = (Array.isArray(lastBackupAt) ? lastBackupAt : [lastBackupAt]).filter((value): value is string => Boolean(value)).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (timestamps.length === 0) return { tone: "danger", label: "لا توجد نسخة", summary: "لا توجد نسخة احتياطية مسجلة", detail: "أنشئ نسخة بعد التحقق من نطاق البيانات المراد حمايتها." };
  const completed = new Date(Math.max(...timestamps));
  if (Number.isNaN(completed.getTime())) return { tone: "warning", label: "وقت غير واضح", summary: "لا يمكن تقييم حداثة النسخة", detail: "تحقق من وقت اكتمال النسخة في مصدرها." };
  const age = now.getTime() - completed.getTime();
  if (age <= 24 * 60 * 60 * 1000) return { tone: "success", label: "حديثة", summary: "آخر نسخة احتياطية حديثة", detail: "ما زالت الاستعادة إجراءً مدمرًا ويستلزم مراجعة المعاينة." };
  return { tone: "warning", label: "قديمة", summary: "آخر نسخة احتياطية أقدم من يوم", detail: "راجع جدول النسخ أو أنشئ نسخة جديدة قبل أي تغيير حساس." };
}

export type ErrorGroup = { key: "network" | "access" | "other"; count: number; label: string; recovery: string };

function categorize(message: string): Omit<ErrorGroup, "count"> {
  if (/network|fetch|connection|اتصال/i.test(message)) return { key: "network", label: "تعذر الاتصال", recovery: "تحقق من الاتصال ثم أعد المحاولة." };
  if (/forbidden|unauthori[sz]ed|permission|صلاح/i.test(message)) return { key: "access", label: "صلاحية غير كافية", recovery: "تحقق من صلاحياتك أو تواصل مع المسؤول." };
  return { key: "other", label: "خطأ يحتاج مراجعة", recovery: "انسخ الملخص المنقّح وأرفقه في طلب الدعم." };
}

export function groupActionErrors(entries: Array<{ message: string; page?: string }>): ErrorGroup[] {
  const groups = new Map<ErrorGroup["key"], ErrorGroup>();
  for (const entry of entries) {
    const group = categorize(entry.message);
    const current = groups.get(group.key);
    groups.set(group.key, current ? { ...current, count: current.count + 1 } : { ...group, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

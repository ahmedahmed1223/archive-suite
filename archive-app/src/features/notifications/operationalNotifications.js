export function createConnectionStatusNotification(previous = null, next = {}) {
  if (!next?.state || previous?.state === next.state) return null;
  if (next.state === "online" && previous && previous.state !== "online" && previous.state !== "local") {
    return {
      key: "connection-online",
      type: "success",
      category: "system",
      title: "عاد الاتصال بالخادم",
      message: next.lastLatencyMs != null ? `الاتصال مستقر الآن. زمن الاستجابة ${Math.round(next.lastLatencyMs)}ms.` : "الاتصال مستقر الآن.",
      actionLabel: "فتح حالة النظام"
    };
  }
  if (next.state === "degraded") {
    return {
      key: `connection-degraded:${next.lastError || ""}`,
      type: "warning",
      category: "system",
      title: "الخادم يعمل بحالة متدهورة",
      message: next.lastError || "فحص قاعدة البيانات لم ينجح. راجع حالة النظام قبل عمليات الاستيراد أو التصدير.",
      actionLabel: "فتح الإعدادات"
    };
  }
  if (next.state === "offline") {
    return {
      key: `connection-offline:${next.lastError || ""}`,
      type: "error",
      category: "system",
      title: "انقطع الاتصال بالخادم",
      message: next.lastError || "تعذر الوصول إلى الخادم. سيحاول التطبيق إعادة الفحص تلقائياً.",
      actionLabel: "فتح الإعدادات"
    };
  }
  if (next.state === "reconnecting") {
    return {
      key: `connection-reconnecting:${next.lastError || ""}`,
      type: "warning",
      category: "system",
      title: "إعادة الاتصال بالخادم",
      message: next.lastError || "نحاول استعادة الاتصال دون إزعاجك بتكرار التنبيه.",
      actionLabel: "فتح الإعدادات"
    };
  }
  return null;
}

export function shouldEmitOperationalNotification(notice, memory = {}, now = Date.now(), cooldownMs = 60_000) {
  if (!notice?.key) return false;
  const last = memory[notice.key] || 0;
  return now - last >= cooldownMs;
}

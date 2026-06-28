export const ERROR_CATEGORIES = {
  NETWORK: "network",
  AUTH: "auth",
  VALIDATION: "validation",
  SERVER: "server",
  NOT_FOUND: "not_found",
  RATE_LIMIT: "rate_limit",
  UNKNOWN: "unknown"
} as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];

interface ErrorLike {
  status?: number;
  statusCode?: number;
  code?: string;
  data?: { code?: string };
  message?: string;
  error?: string;
  name?: string;
}

interface CategorizedError {
  category: ErrorCategory;
  message: string;
  retry: boolean;
}

const STATUS_MESSAGES: Record<number, Omit<CategorizedError, "retry">> = {
  400: { category: ERROR_CATEGORIES.VALIDATION, message: "البيانات المُرسَلة غير صالحة. راجع المدخلات وأعد المحاولة." },
  401: { category: ERROR_CATEGORIES.AUTH, message: "انتهت صلاحية جلسة العمل. الرجاء تسجيل الدخول مجدداً." },
  403: { category: ERROR_CATEGORIES.AUTH, message: "ليس لديك صلاحية للقيام بهذا الإجراء." },
  404: { category: ERROR_CATEGORIES.NOT_FOUND, message: "العنصر المطلوب غير موجود أو تم حذفه." },
  409: { category: ERROR_CATEGORIES.VALIDATION, message: "تعارض في البيانات. قد يكون العنصر موجوداً مسبقاً." },
  413: { category: ERROR_CATEGORIES.VALIDATION, message: "حجم الملف أو البيانات يتجاوز الحد المسموح به." },
  429: { category: ERROR_CATEGORIES.RATE_LIMIT, message: "تم إرسال طلبات كثيرة. انتظر لحظة وأعد المحاولة." },
  500: { category: ERROR_CATEGORIES.SERVER, message: "خطأ في الخادم. يُرجى الإبلاغ إذا تكرر المشكل." },
  502: { category: ERROR_CATEGORIES.SERVER, message: "الخادم غير متاح مؤقتاً. أعد المحاولة بعد قليل." },
  503: { category: ERROR_CATEGORIES.SERVER, message: "الخدمة غير متاحة حالياً. أعد المحاولة لاحقاً." }
};

const CODE_MESSAGES: Record<string, Omit<CategorizedError, "retry">> = {
  TOTP_REQUIRED: { category: ERROR_CATEGORIES.AUTH, message: "أدخل رمز التحقق الثنائي من تطبيق المصادقة." },
  TOTP_INVALID: { category: ERROR_CATEGORIES.AUTH, message: "رمز التحقق الثنائي غير صحيح أو منتهي الصلاحية." },
  TOKEN_REVOKED: { category: ERROR_CATEGORIES.AUTH, message: "انتهت الجلسة. الرجاء تسجيل الدخول مجدداً." },
  UNAUTHORIZED: { category: ERROR_CATEGORIES.AUTH, message: "يجب تسجيل الدخول أولاً." }
};

export function categorizeError(error: unknown): CategorizedError {
  const err = error as ErrorLike | null | undefined;
  if (!navigator.onLine || err?.message?.includes("fetch") || err?.name === "TypeError") {
    return {
      category: ERROR_CATEGORIES.NETWORK,
      message: "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وأعد المحاولة.",
      retry: true
    };
  }

  const status = err?.status || err?.statusCode;
  if (status && STATUS_MESSAGES[status]) {
    return { ...STATUS_MESSAGES[status], retry: status >= 500 || status === 429 };
  }

  const code = err?.code || err?.data?.code;
  if (code && CODE_MESSAGES[code]) {
    return { ...CODE_MESSAGES[code], retry: false };
  }

  const serverMsg = err?.message || err?.error;
  if (serverMsg && /[؀-ۿ]/.test(serverMsg)) {
    return { category: ERROR_CATEGORIES.UNKNOWN, message: serverMsg, retry: false };
  }

  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    message: "حدث خطأ غير متوقع. أعد المحاولة أو تواصل مع الدعم الفني.",
    retry: true
  };
}

export function formatErrorMessage(error: unknown): string {
  const { message, retry } = categorizeError(error);
  return retry ? `${message} (يمكنك المحاولة مجدداً)` : message;
}

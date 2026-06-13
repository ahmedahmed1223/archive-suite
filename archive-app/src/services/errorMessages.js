/**
 * Error categorization and user-friendly Arabic messages.
 * Maps HTTP status codes, error codes, and network failures to
 * specific, actionable Arabic error messages.
 */

export const ERROR_CATEGORIES = {
  NETWORK: "network",
  AUTH: "auth",
  VALIDATION: "validation",
  SERVER: "server",
  NOT_FOUND: "not_found",
  RATE_LIMIT: "rate_limit",
  UNKNOWN: "unknown",
};

const STATUS_MESSAGES = {
  400: { category: ERROR_CATEGORIES.VALIDATION, message: "البيانات المُرسَلة غير صالحة. راجع المدخلات وأعد المحاولة." },
  401: { category: ERROR_CATEGORIES.AUTH, message: "انتهت صلاحية جلسة العمل. الرجاء تسجيل الدخول مجدداً." },
  403: { category: ERROR_CATEGORIES.AUTH, message: "ليس لديك صلاحية للقيام بهذا الإجراء." },
  404: { category: ERROR_CATEGORIES.NOT_FOUND, message: "العنصر المطلوب غير موجود أو تم حذفه." },
  409: { category: ERROR_CATEGORIES.VALIDATION, message: "تعارض في البيانات. قد يكون العنصر موجوداً مسبقاً." },
  413: { category: ERROR_CATEGORIES.VALIDATION, message: "حجم الملف أو البيانات يتجاوز الحد المسموح به." },
  429: { category: ERROR_CATEGORIES.RATE_LIMIT, message: "تم إرسال طلبات كثيرة. انتظر لحظة وأعد المحاولة." },
  500: { category: ERROR_CATEGORIES.SERVER, message: "خطأ في الخادم. يُرجى الإبلاغ إذا تكرر المشكل." },
  502: { category: ERROR_CATEGORIES.SERVER, message: "الخادم غير متاح مؤقتاً. أعد المحاولة بعد قليل." },
  503: { category: ERROR_CATEGORIES.SERVER, message: "الخدمة غير متاحة حالياً. أعد المحاولة لاحقاً." },
};

const CODE_MESSAGES = {
  TOTP_REQUIRED: { category: ERROR_CATEGORIES.AUTH, message: "أدخل رمز التحقق الثنائي من تطبيق المصادقة." },
  TOTP_INVALID: { category: ERROR_CATEGORIES.AUTH, message: "رمز التحقق الثنائي غير صحيح أو منتهي الصلاحية." },
  TOKEN_REVOKED: { category: ERROR_CATEGORIES.AUTH, message: "انتهت الجلسة. الرجاء تسجيل الدخول مجدداً." },
  UNAUTHORIZED: { category: ERROR_CATEGORIES.AUTH, message: "يجب تسجيل الدخول أولاً." },
};

/**
 * Categorize an error and return a user-friendly Arabic message.
 * @param {Error|Response|object} error
 * @returns {{ category: string, message: string, retry: boolean }}
 */
export function categorizeError(error) {
  // Network failure (no response)
  if (!navigator.onLine || error?.message?.includes("fetch") || error?.name === "TypeError") {
    return {
      category: ERROR_CATEGORIES.NETWORK,
      message: "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وأعد المحاولة.",
      retry: true,
    };
  }

  // HTTP status code
  const status = error?.status || error?.statusCode;
  if (status && STATUS_MESSAGES[status]) {
    return { ...STATUS_MESSAGES[status], retry: status >= 500 || status === 429 };
  }

  // Error code (from server JSON)
  const code = error?.code || error?.data?.code;
  if (code && CODE_MESSAGES[code]) {
    return { ...CODE_MESSAGES[code], retry: false };
  }

  // Server error message (pass through if Arabic)
  const serverMsg = error?.message || error?.error;
  if (serverMsg && /[؀-ۿ]/.test(serverMsg)) {
    return { category: ERROR_CATEGORIES.UNKNOWN, message: serverMsg, retry: false };
  }

  // Fallback
  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    message: "حدث خطأ غير متوقع. أعد المحاولة أو تواصل مع الدعم الفني.",
    retry: true,
  };
}

/**
 * Format an error for display in a toast or alert.
 */
export function formatErrorMessage(error) {
  const { message, retry } = categorizeError(error);
  return retry ? `${message} (يمكنك المحاولة مجدداً)` : message;
}

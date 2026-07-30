/**
 * V1-836: pure helpers for the pre-share checklist. No side effects, no API
 * calls - files/page.tsx owns wiring these into state and the network call.
 */

const DEFAULT_EXPIRY_DAYS = 7;

/** Renders an instant as the "YYYY-MM-DDTHH:mm" value a datetime-local input expects. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultShareExpiryLocalValue(now: Date): string {
  return toDatetimeLocalValue(new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
}

export type ShareExpiryValidation =
  | { valid: true; iso: string }
  | { valid: false; message: string };

/** A datetime-local input reads as browser-local wall-clock time; `new Date(value)` already interprets it that way. */
export function validateShareExpiry(localValue: string, now: Date): ShareExpiryValidation {
  if (!localValue.trim()) {
    return { valid: false, message: "حدد تاريخ انتهاء لرابط المشاركة." };
  }

  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, message: "تاريخ الانتهاء غير صالح." };
  }

  if (parsed.getTime() <= now.getTime()) {
    return { valid: false, message: "تاريخ الانتهاء يجب أن يكون في المستقبل." };
  }

  return { valid: true, iso: parsed.toISOString() };
}

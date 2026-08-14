/**
 * V1-712 Task 6: pure helpers for the "schedule processing" upload path.
 * No side effects, no API calls — the wizard (UploadForm.tsx) owns wiring
 * these into state and network calls.
 */

import type { AppLocale } from "./i18n/types";

const LOCAL_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type ScheduleValidationErrorCode = "invalid" | "past" | "dst-gap";

export type ScheduleValidation =
  | { valid: true; utc: string }
  | { valid: false; code: ScheduleValidationErrorCode; message: string };

export type ScheduledUploadStage = "uploading" | "staging" | "scheduled";

const STAGE_LABELS: Record<AppLocale, Record<ScheduledUploadStage, string>> = {
  ar: {
    uploading: "رفع الملف",
    staging: "التحقق والحفظ للموعد",
    scheduled: "تمت الجدولة"
  },
  en: {
    uploading: "Uploading file",
    staging: "Validating and staging for schedule",
    scheduled: "Scheduled"
  }
};

const VALIDATION_MESSAGES: Record<AppLocale, Record<ScheduleValidationErrorCode, string>> = {
  ar: {
    invalid: "صيغة التاريخ والوقت غير صحيحة.",
    past: "يجب أن يكون وقت الجدولة في المستقبل.",
    "dst-gap": "هذا الوقت غير موجود بسبب انتقال التوقيت الصيفي في هذه المنطقة الزمنية."
  },
  en: {
    invalid: "The date and time format is invalid.",
    past: "The scheduled time must be in the future.",
    "dst-gap": "This time does not exist because of daylight saving time in the selected time zone."
  }
};

/** Wall-clock offset (minutes) a zone is ahead of UTC at the given instant. */
function getZoneOffsetMinutes(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** Renders an instant as the "YYYY-MM-DDTHH:mm" wall clock reading in `zone`. */
function formatWallClock(instant: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(instant);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

/**
 * Resolves a "YYYY-MM-DDTHH:mm" wall-clock reading in `zone` to a UTC instant.
 * Uses the standard guess-and-correct approach (no Temporal/date-fns-tz
 * dependency needed — Intl.DateTimeFormat already carries the IANA data).
 * `matches: false` means the wall clock never occurred in that zone (DST gap).
 */
function resolveZonedInstant(localValue: string, zone: string): { utcMs: number; matches: boolean } | null {
  const naiveUtcMs = Date.parse(`${localValue}:00.000Z`);
  if (Number.isNaN(naiveUtcMs)) return null;

  let offsetMinutes = getZoneOffsetMinutes(new Date(naiveUtcMs), zone);
  let utcMs = naiveUtcMs - offsetMinutes * 60_000;

  const secondOffset = getZoneOffsetMinutes(new Date(utcMs), zone);
  if (secondOffset !== offsetMinutes) {
    offsetMinutes = secondOffset;
    utcMs = naiveUtcMs - offsetMinutes * 60_000;
  }

  const matches = formatWallClock(new Date(utcMs), zone) === localValue;
  return { utcMs, matches };
}

/** Validates a scheduled-upload local date/time against a zone and "now". */
export function validateScheduleTime(localValue: string, zone: string, now: Date, locale: AppLocale = "ar"): ScheduleValidation {
  if (!LOCAL_VALUE_PATTERN.test(localValue)) {
    return { valid: false, code: "invalid", message: VALIDATION_MESSAGES[locale].invalid };
  }

  const resolved = resolveZonedInstant(localValue, zone);
  if (!resolved) {
    return { valid: false, code: "invalid", message: VALIDATION_MESSAGES[locale].invalid };
  }

  if (!resolved.matches) {
    return {
      valid: false,
      code: "dst-gap",
      message: VALIDATION_MESSAGES[locale]["dst-gap"]
    };
  }

  if (resolved.utcMs <= now.getTime()) {
    return { valid: false, code: "past", message: VALIDATION_MESSAGES[locale].past };
  }

  return { valid: true, utc: new Date(resolved.utcMs).toISOString() };
}

/** Localized summary of a scheduled local time, annotated with its IANA zone. */
export function scheduleSummary(localValue: string, zone: string, locale: string): string {
  const resolved = resolveZonedInstant(localValue, zone);
  if (!resolved || !resolved.matches) {
    return locale.startsWith("en") ? "This time is invalid in the selected time zone." : "وقت غير صالح لهذه المنطقة الزمنية.";
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: zone
  }).format(new Date(resolved.utcMs));

  return `${formatted} (${zone})`;
}

/** Localized progress label for a stage of the schedule-upload flow. */
export function scheduledUploadProgress(stage: ScheduledUploadStage, locale: AppLocale = "ar"): string {
  return STAGE_LABELS[locale][stage];
}

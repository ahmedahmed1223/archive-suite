import { describe, expect, it } from "vitest";
import { scheduleSummary, scheduledUploadProgress, validateScheduleTime } from "./scheduled-upload";

const fixedNow = new Date("2026-07-20T09:00:00.000Z");

describe("validateScheduleTime", () => {
  it("accepts a future local time and returns the UTC instant", () => {
    expect(validateScheduleTime("2026-07-21T09:30", "Europe/Istanbul", fixedNow)).toEqual({
      valid: true,
      utc: "2026-07-21T06:30:00.000Z"
    });
  });

  it("rejects a local time already in the past", () => {
    const result = validateScheduleTime("2026-07-19T08:00", "Europe/Istanbul", fixedNow);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.code).toBe("past");
  });

  it("rejects a local time that falls inside a DST spring-forward gap", () => {
    const result = validateScheduleTime("2026-03-29T02:30", "Europe/Berlin", fixedNow);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.code).toBe("dst-gap");
  });

  it("rejects a malformed local value", () => {
    const result = validateScheduleTime("not-a-date", "Europe/Istanbul", fixedNow);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.code).toBe("invalid");
  });
});

describe("scheduleSummary", () => {
  it("renders an Arabic-locale summary annotated with the IANA zone", () => {
    expect(scheduleSummary("2026-07-21T09:30", "Europe/Istanbul", "ar-SA")).toBe(
      "الثلاثاء، ٢١ يوليو ٢٠٢٦ في ٩:٣٠ ص (Europe/Istanbul)"
    );
  });

  it("reports an unresolvable summary for a DST-gap local time", () => {
    expect(scheduleSummary("2026-03-29T02:30", "Europe/Berlin", "ar-SA")).toBe(
      "وقت غير صالح لهذه المنطقة الزمنية."
    );
  });
});

describe("scheduledUploadProgress", () => {
  it("labels the uploading stage", () => {
    expect(scheduledUploadProgress("uploading")).toBe("رفع الملف");
  });

  it("labels the staging stage", () => {
    expect(scheduledUploadProgress("staging")).toBe("التحقق والحفظ للموعد");
  });

  it("labels the scheduled stage", () => {
    expect(scheduledUploadProgress("scheduled")).toBe("تمت الجدولة");
  });
});

export const RTL_DOCUMENT_CONTRACT = Object.freeze({
  language: "ar",
  direction: "rtl"
});

/** LTR is permitted only for inherently machine-readable values. */
export const RTL_LTR_EXCEPTION_KINDS = Object.freeze([
  "identifier",
  "email",
  "url",
  "path",
  "code",
  "timecode",
  "coordinate"
] as const);

export type RtlLtrExceptionKind = (typeof RTL_LTR_EXCEPTION_KINDS)[number];

export function isRtlLtrException(value: string): value is RtlLtrExceptionKind {
  return (RTL_LTR_EXCEPTION_KINDS as readonly string[]).includes(value);
}


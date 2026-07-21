// V1-306B: catches Arabic UTF-8 text that got mis-decoded as Latin-1/
// Windows-1252 (a recurring bug class in this codebase - see the 2026-07-11
// session notes). Every UTF-8 continuation byte for Arabic script is >=0x80,
// so a mis-decode reinterprets each byte 1:1 as a Latin-1 Supplement
// codepoint (0x80-0xFF), producing long runs of them. Genuine text (an
// accented Latin name like "cafe") never has 4+ of these back to back, so a
// run of 4+ is a safe corruption fingerprint.
//
// Built from numeric char codes rather than a literal character-class
// escape in source: typing the raw escape text next to this comment has
// proven to silently mutate into the actual non-ASCII characters in this
// editing pipeline - exactly the corruption class this file guards against.
function charClassRange(low: number, high: number): string {
  const hex = (code: number) => code.toString(16).padStart(4, "0");
  return `\\u${hex(low)}-\\u${hex(high)}`;
}

const MOJIBAKE_RUN = new RegExp(`[${charClassRange(0x80, 0xff)}]{4,}`, "g");
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

export function findMojibake(text: string): string[] {
  const hits = new Set(text.match(MOJIBAKE_RUN) ?? []);
  if (text.includes(REPLACEMENT_CHAR)) hits.add(REPLACEMENT_CHAR);
  return [...hits];
}

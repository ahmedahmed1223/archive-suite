import { describe, expect, it } from "vitest";
import { presenceInitials, recordPresenceRoom } from "./record-presence";

describe("record presence", () => {
  it("builds a stable room key", () => expect(recordPresenceRoom("abc/12")).toBe("record:abc/12"));
  it("uses up to two name initials", () => expect(presenceInitials("ليلى أحمد حسن")).toBe("لح"));
});

import { describe, expect, it } from "vitest";
import { checkStorageCapacity } from "./storage-capacity-alert";

describe("storage capacity alert (V1-859)", () => {
  it("is ok below the warning threshold", () => {
    expect(checkStorageCapacity(50, 100).level).toBe("ok");
  });

  it("warns at or above 80% usage", () => {
    const result = checkStorageCapacity(80, 100);
    expect(result.level).toBe("warning");
    expect(result.message).toContain("80%");
  });

  it("uses English capacity warnings when English is selected", () => {
    expect(checkStorageCapacity(80, 100, "en").message).toBe("Staging storage is nearing capacity (80%).");
  });

  it("is critical at or above 95% usage", () => {
    const result = checkStorageCapacity(96, 100);
    expect(result.level).toBe("critical");
    expect(result.message).toBeTruthy();
  });

  it("treats zero or unknown total as ok rather than dividing by zero", () => {
    expect(checkStorageCapacity(10, 0)).toEqual({ level: "ok", percentUsed: 0, message: null });
  });
});

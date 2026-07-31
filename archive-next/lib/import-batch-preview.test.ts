import { describe, expect, it } from "vitest";
import { buildImportBatchPreview } from "./import-batch-preview";

describe("import batch preview (V1-857)", () => {
  it("passes through name/size/checksum/duration for each file", () => {
    const preview = buildImportBatchPreview(
      [{ name: "clip.mp4", size: 100, checksum: "sum1", durationSeconds: 30 }],
      new Set()
    );
    expect(preview[0]).toMatchObject({ name: "clip.mp4", size: 100, checksum: "sum1", durationSeconds: 30 });
  });

  it("flags a file whose checksum already exists in the archive", () => {
    const preview = buildImportBatchPreview([{ name: "a.mp4", size: 1, checksum: "existing" }], new Set(["existing"]));
    expect(preview[0].isDuplicate).toBe(true);
  });

  it("flags a second file in the same batch with a repeated checksum", () => {
    const preview = buildImportBatchPreview(
      [
        { name: "a.mp4", size: 1, checksum: "same" },
        { name: "b.mp4", size: 1, checksum: "same" }
      ],
      new Set()
    );
    expect(preview[0].isDuplicate).toBe(false);
    expect(preview[1].isDuplicate).toBe(true);
  });

  it("does not flag a file with a unique checksum", () => {
    const preview = buildImportBatchPreview([{ name: "a.mp4", size: 1, checksum: "unique" }], new Set(["other"]));
    expect(preview[0].isDuplicate).toBe(false);
  });
});

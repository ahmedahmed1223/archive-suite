export const TRANSFER_PACKAGE_TYPE = "video-archive-transfer";
export const TRANSFER_SCHEMA_VERSION = 1;
export const TRANSFER_APP_VERSION = "2.0";

export const EXCEL_ARCHIVE_PAYLOAD_SHEET = "__archive_payload";
export const EXCEL_ARCHIVE_PACKAGE_TYPE = "video-archive-excel-export";
export const EXCEL_ARCHIVE_SCHEMA_VERSION = 1;
export const EXCEL_ARCHIVE_CHUNK_SIZE = 3e4;

export function stableStringifyForChecksum(value: unknown): string {
  const normalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.keys(input).sort().reduce((output: Record<string, unknown>, key) => {
        const nextValue = input[key];
        if (nextValue !== void 0) output[key] = normalize(nextValue);
        return output;
      }, {});
    }
    return input;
  };

  return JSON.stringify(normalize(value));
}

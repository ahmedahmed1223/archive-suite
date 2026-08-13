import { describe, expect, test, vi } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";

const { requestHeaders } = vi.hoisted(() => ({ requestHeaders: vi.fn() }));

vi.mock("next/font/google", () => ({ IBM_Plex_Sans_Arabic: () => ({ variable: "--font-arabic" }) }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));
vi.mock("@/components/AppProviders", () => ({ default: () => null }));
vi.mock("@/components/ClientErrorReporter", () => ({ default: () => null }));

import { generateMetadata, metadataDescription } from "./layout";

describe("root metadata", () => {
  test("uses an English description for the English locale", () => {
    expect(metadataDescription("en")).toBe(getDictionary("en").auth.login.description);
    expect(metadataDescription("ar")).toBe(getDictionary("ar").auth.login.description);
  });

  test("derives metadata from the forwarded request locale", async () => {
    requestHeaders.mockResolvedValue(new Headers({ "x-archive-locale": "en" }));

    await expect(generateMetadata()).resolves.toMatchObject({ description: getDictionary("en").auth.login.description });
  });
});

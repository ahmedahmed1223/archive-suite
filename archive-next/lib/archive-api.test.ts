import { describe, expect, it, vi } from "vitest";
import { createArchiveApiClient, type ApiEnvelope, type BulkMacroRun, type BulkMacroStep, type SafetyPreviewRun } from "./archive-api";

describe("archive API uploads", () => {
  it("uses the access token issued by login for multipart uploads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        ok: true,
        user: { id: "admin", email: "admin@example.test", role: "admin" },
        accessToken: "live-access-token",
        expiresAt: "2030-01-01T00:00:00.000Z"
      }))
      .mockResolvedValueOnce(Response.json({
        ok: true,
        record: { id: "upload-1", uid: "upload-1", fileName: "acceptance.wav", filePath: "uploads/acceptance.wav", checksum: "checksum", source: "upload" }
      }));
    const api = createArchiveApiClient({ baseUrl: "http://archive.test/api/v1", fetchImpl });

    await api.login({ email: "admin@example.test", password: "not-a-real-password" });
    await api.uploadFile(new File(["audio"], "acceptance.wav", { type: "audio/wav" }));

    const uploadRequest = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(uploadRequest.headers).get("Authorization")).toBe("Bearer live-access-token");
  });
});

describe("archive API report exports", () => {
  it("uses the access token issued by login when downloading the compliance CSV", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        ok: true,
        user: { id: "admin", email: "admin@example.test", role: "admin" },
        accessToken: "report-access-token",
        expiresAt: "2030-01-01T00:00:00.000Z"
      }))
      .mockResolvedValueOnce(new Response("event,resource\nrecords.bulk_upsert,record\n", {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="compliance.csv"' }
      }));
    const api = createArchiveApiClient({ baseUrl: "http://archive.test/api/v1", fetchImpl });

    await api.login({ email: "admin@example.test", password: "not-a-real-password" });
    await api.downloadComplianceReport();

    const exportRequest = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(exportRequest.headers).get("Authorization")).toBe("Bearer report-access-token");
  });
});

describe("archive API authentication", () => {
  it("sends the explicit remember-me choice when logging in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      ok: true,
      user: { id: "admin", email: "admin@example.test", role: "admin" },
      accessToken: "live-access-token",
      expiresAt: "2030-01-01T00:00:00.000Z"
    }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });

    await api.login({ email: "admin@example.test", password: "not-a-real-password", rememberMe: true });

    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      email: "admin@example.test",
      password: "not-a-real-password",
      rememberMe: true
    }));
  });

  it("updates the authenticated account locale through the preferences endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      ok: true,
      user: { id: "admin", email: "admin@example.test", role: "admin", locale: "en" },
    }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });

    await api.updateAccountPreferences({ locale: "en" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/account/preferences",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ locale: "en" }) }),
    );
  });
});

describe("department vocabulary preferences API client", () => {
  it("loads prioritized terms and replaces the selected department preferences", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, terms: [], preferredTermIds: [] }), { status: 200 }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });

    await api.vocabularyTerms("news & archives");
    await api.replaceDepartmentVocabularyPreferences("news & archives", ["term-1", "term-2"]);

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/vocabulary?departmentId=news%20%26%20archives",
      "/api/v1/vocabulary/department-preferences"
    ]);
    expect(fetchImpl.mock.calls[1]?.[1]?.method).toBe("PUT");
    expect(fetchImpl.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ departmentId: "news & archives", termIds: ["term-1", "term-2"] }));
  });
});

describe("safety preview API client", () => {
  it("exposes the required synthetic marker on preview errors without changing generic errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      synthetic: true,
      error: "Forbidden.",
      code: "FORBIDDEN"
    }), { status: 403 }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });

    const response = await api.runSafetyPreview({ scenario: "restore-conflict", operation: "restore", ids: ["conflict"] });
    if (response.ok) throw new Error("Expected a synthetic preview error");

    const marker: true = response.synthetic;
    expect(marker).toBe(true);
    expect(response.code).toBe("FORBIDDEN");

    const genericError: Extract<ApiEnvelope<SafetyPreviewRun>, { ok: false }> = { ok: false, error: "Generic error" };
    expect("synthetic" in genericError).toBe(false);
  });

  it("uses only synthetic preview endpoints", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, synthetic: true, scenarios: [
        { id: "bulk-delete-basic", description: "حذف جماعي تجريبي لسجلات اصطناعية" },
        { id: "restore-conflict", description: "استعادة تجريبية تعرض تعارضاً وعنصراً قابلاً للاستعادة" }
      ] }), { status: 200 })
    );
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });

    await api.safetyPreviewScenarios();
    await api.runSafetyPreview({ scenario: "bulk-delete-basic", operation: "delete", ids: ["alpha"] });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/safety-preview/scenarios",
      "/api/v1/safety-preview/run"
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST"]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).not.toContain("/api/v1/records/bulk-delete");
    expect(fetchImpl.mock.calls.map(([url]) => url)).not.toContain("/api/v1/trash/restore");
  });
});

describe("bulk macro API client", () => {
  it("exposes a discriminated step union and failed run outcomes", () => {
    const steps: BulkMacroStep[] = [
      { type: "add-tag", tag: "مهم" },
      { type: "set-workflow-status", status: "review" },
      { type: "delete" }
    ];
    const failedTargetStatus: BulkMacroRun["results"][number]["status"] = "failed";

    // @ts-expect-error add-tag steps require the tag payload.
    const missingTag: BulkMacroStep = { type: "add-tag" };
    // @ts-expect-error delete steps cannot carry another subtype's payload.
    const invalidDelete: BulkMacroStep = { type: "delete", status: "review" };

    expect(steps.map((step) => step.type)).toEqual(["add-tag", "set-workflow-status", "delete"]);
    expect(failedTargetStatus).toBe("failed");
    expect([missingTag, invalidDelete]).toHaveLength(2);
  });

  it("uses the typed CRUD, preview, run, and history routes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl });
    const steps: BulkMacroStep[] = [{ type: "add-tag", tag: "مهم" }];
    const targets = { targets: [{ store: "archive-items", id: "record-1" }] };

    await api.bulkMacros();
    await api.createBulkMacro({ name: "وسم مهم", steps });
    await api.bulkMacro("macro/1");
    await api.updateBulkMacro("macro/1", { steps });
    await api.previewBulkMacro("macro/1", targets);
    await api.runBulkMacro("macro/1", { ...targets, previewToken: "signed" });
    await api.bulkMacroRuns("macro/1");
    await api.deleteBulkMacro("macro/1");

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/bulk-macros",
      "/api/v1/bulk-macros",
      "/api/v1/bulk-macros/macro%2F1",
      "/api/v1/bulk-macros/macro%2F1",
      "/api/v1/bulk-macros/macro%2F1/preview",
      "/api/v1/bulk-macros/macro%2F1/run",
      "/api/v1/bulk-macros/macro%2F1/runs",
      "/api/v1/bulk-macros/macro%2F1"
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST", "GET", "PATCH", "POST", "POST", "GET", "DELETE"]);
  });
});

// V1-818: Arabic error text is keyed on the machine `code`, not the English
// sentence. V1-815 guarantees every {ok:false} envelope carries one.
describe("Arabic API error localization", () => {
  const errorFor = async (body: Record<string, unknown>, status: number, locale?: "ar" | "en") => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    const api = createArchiveApiClient({ baseUrl: "/api/v1", fetchImpl, locale });
    const response = await api.runSafetyPreview({ scenario: "restore-conflict", operation: "restore", ids: ["x"] });
    if (response.ok) throw new Error("Expected an error envelope");
    return response;
  };

  it("translates a known code into Arabic instead of passing the English text through", async () => {
    const response = await errorFor({ ok: false, error: "Record not found.", code: "not_found" }, 404);

    expect(response.error).toBe("العنصر غير موجود.");
    expect(response.error).not.toMatch(/[A-Za-z]/);
  });

  it("keeps the code intact so sentinel branches still work", async () => {
    const response = await errorFor({ ok: false, error: "Forbidden.", code: "FORBIDDEN" }, 403);

    // The four sentinel sites test `response.code` first; that must survive translation.
    expect(response.code).toBe("FORBIDDEN");
    expect(response.error).toBe("لا تملك صلاحية لتنفيذ هذا الإجراء.");
  });

  it("passes unmapped codes through untouched rather than inventing a message", async () => {
    const response = await errorFor({ ok: false, error: "Some new backend error.", code: "brand_new_code" }, 400);

    expect(response.error).toBe("Some new backend error.");
  });

  it("uses English messages when the active interface locale is English", async () => {
    const response = await errorFor({ ok: false, error: "Record not found.", code: "not_found" }, 404, "en");

    expect(response.error).toBe("Item not found.");
  });
});

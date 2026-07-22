import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const contract = readJson("docs/api/archive-contract.openapi.json");

for (const generatedAsset of [
  "scripts/generate-api-types.mjs",
  "scripts/verify-generated-api.test.mjs",
  "archive-next/lib/generated/archive-api.ts"
]) {
  assert.ok(existsSync(path.join(ROOT, generatedAsset)), `Generated API asset should exist: ${generatedAsset}`);
}

assert.equal(contract.openapi, "3.1.0", "API contract should use OpenAPI 3.1.0");
assert.equal(contract.info?.title, "Archive Suite API Contract", "API contract title should be stable");

for (const pathName of [
  "/health",
  "/auth/login",
  "/auth/me",
  "/auth/refresh",
  "/auth/logout",
  "/records",
  "/records/{id}/attachments",
  "/records/{id}/attachments/{attachmentId}",
  "/records/bulk",
  "/records/{id}/notes",
  "/record-notes/{id}",
  "/records/{id}/comments",
  "/record-comments/{id}",
  "/records/{id}/history",
  "/activity",
  "/reports/compliance",
  "/reports/compliance/export",
  "/plugins",
  "/sync",
  "/search",
  "/discover",
  "/suggestions",
  "/suggestions/{key}/feedback",
  "/relations/graph",
  "/relations",
  "/relations/{id}",
  "/files",
  "/files/browser",
  "/files/{key}",
  "/folders",
  "/media/{mediaUid}/review-links",
  "/review-links/{token}",
  "/collaboration/rooms/{roomKey}/presence",
  "/collaboration/rooms/{roomKey}/locks",
  "/collaboration/rooms/{roomKey}/locks/release",
  "/collaboration/rooms/{roomKey}/documents/{resourceId}",
  "/system/odbc",
  "/system/odbc/tables/{table}",
  "/system/odbc/tables/{table}/rows",
  "/rights",
  "/rights/expiring",
  "/rights/{itemId}/enforcement",
  "/public/catalog",
  "/share",
  "/share/{token}",
  "/records/bulk-delete",
  "/safety-preview/scenarios",
  "/safety-preview/run",
  "/users",
  "/users/{id}",
  "/invitations/{token}/accept",
  "/system/security-settings",
  "/system/backups",
  "/system/backups/run",
  "/system/backups/preview",
  "/system/backups/restore",
  "/intake-templates",
  "/intake-templates/{id}",
  "/import/preview",
  "/upload-links",
  "/upload-links/{token}",
  "/upload-links/{id}/revoke",
  "/uploads/schedules",
  "/uploads/schedules/{id}",
  "/uploads/schedules/{id}/retry",
  "/saved-searches",
  "/saved-searches/{id}",
  "/collections",
  "/collections/{id}",
  "/inbox",
  "/inbox/{id}",
  "/vocabulary",
  "/vocabulary/{id}",
  "/tag-nodes",
  "/tag-nodes/{id}",
  "/automation/rules",
  "/automation/rules/{id}",
  "/automation/rules/{id}/run",
  "/bulk-macros",
  "/bulk-macros/{id}",
  "/bulk-macros/{id}/preview",
  "/bulk-macros/{id}/run",
  "/bulk-macros/{id}/runs",
  "/system/status",
  "/system/dr-probe",
  "/system/control/{action}",
  "/account/export"
]) {
  assert.ok(contract.paths?.[pathName], `API contract should include ${pathName}`);
}

for (const schemaName of [
  "OkEnvelope",
  "ErrorEnvelope",
  "AuthResponse",
  "User",
  "ArchiveRecord",
  "RecordCreateRequest",
  "RecordAttachment",
  "RecordAttachmentsResponse",
  "PublicCatalogRecord",
  "PublicCatalogResponse",
  "PluginRuntimePolicy",
  "PluginPermission",
  "PluginSecurityReview",
  "PluginCatalogItem",
  "PluginPermissionScopeSummary",
  "PluginCatalogResponse",
  "RecordNoteRegion",
  "RecordNote",
  "RecordNoteCreateRequest",
  "RecordNoteUpdateRequest",
  "RecordNotesResponse",
  "RecordNoteResponse",
  "RecordComment",
  "RecordCommentCreateRequest",
  "RecordCommentsResponse",
  "RecordCommentResponse",
  "RecordHistoryEntry",
  "RecordHistoryResponse",
  "ActivityResponse",
  "ComplianceReportEntry",
  "ComplianceReportSummary",
  "ComplianceReportResponse",
  "SyncLogEntry",
  "SyncSummary",
  "SyncLogResponse",
  "SearchFacetBucket",
  "SearchFacets",
  "DiscoverSection",
  "DiscoverResponse",
  "SuggestionContext",
  "SuggestionFeedbackValue",
  "ArchiveSuggestion",
  "SuggestionFeedback",
  "SuggestionFeedbackRequest",
  "SuggestionsResponse",
  "SuggestionFeedbackResponse",
  "RelationType",
  "RelationTypeOption",
  "RecordRelation",
  "RelationGraphNode",
  "RelationGraphEdge",
  "RelationGraphStats",
  "RelationGraphResponse",
  "CreateRecordRelationRequest",
  "UpdateRecordRelationRequest",
  "RecordRelationResponse",
  "FileEntry",
  "Folder",
  "RightsRecord",
  "ReviewComment",
  "CreateReviewLinkResponse",
  "ReviewLinkPayloadResponse",
  "CollaborationParticipant",
  "CollaborationPresenceResponse",
  "CollaborationLock",
  "CollaborationLocksResponse",
  "CollaborationDocument",
  "CollaborationDocumentUpdateRequest",
  "CollaborationDocumentResponse",
  "OdbcProbe",
  "OdbcStatusResponse",
  "OdbcTablePreviewResponse",
  "OdbcRowWriteRequest",
  "OdbcRowKeyRequest",
  "OdbcWriteResponse",
  "SharePayloadResponse",
  "BulkDeleteRecordsRequest",
  "BulkDeleteRecordsResponse",
  "SafetyPreviewScenario",
  "SafetyPreviewOperation",
  "SafetyPreviewCounts",
  "SafetyPreviewResult",
  "SafetyPreviewScenariosResponse",
  "SafetyPreviewRunRequest",
  "SafetyPreviewRunResponse",
  "UserAccount",
  "UserInvitation",
  "InviteUserRequest",
  "AcceptInvitationRequest",
  "SecuritySettings",
  "BackupInfo",
  "BackupListResponse",
  "BackupPreviewResponse",
  "BackupRestoreResponse",
  "IntakeTemplate",
  "IntakeTemplateCreateRequest",
  "IntakeTemplatesResponse",
  "IntakeTemplateResponse",
  "ImportPreviewRequest",
  "ImportPreview",
  "ImportPreviewResponse",
  "UploadLink",
  "UploadLinkCreateRequest",
  "UploadLinksResponse",
  "UploadLinkResponse",
  "ScheduledUploadStatus",
  "ScheduledUploadRecordPayload",
  "CreateScheduledUploadRequest",
  "RescheduleUploadRequest",
  "ScheduledUploadStaged",
  "ScheduledUploadCreateResponse",
  "ScheduledUpload",
  "ScheduledUploadResponse",
  "ScheduledUploadListResponse",
  "SavedSearch",
  "SavedSearchCreateRequest",
  "SavedSearchesResponse",
  "SavedSearchResponse",
  "Collection",
  "CollectionCreateRequest",
  "CollectionsResponse",
  "CollectionResponse",
  "InboxStatus",
  "InboxItem",
  "InboxItemCreateRequest",
  "InboxItemUpdateRequest",
  "InboxItemsResponse",
  "InboxItemResponse",
  "VocabularyTerm",
  "VocabularyTermCreateRequest",
  "VocabularyTermsResponse",
  "VocabularyTermResponse",
  "TagNode",
  "TagNodeCreateRequest",
  "TagNodeUpdateRequest",
  "TagNodesResponse",
  "TagNodeResponse",
  "AutomationRuleTrigger",
  "AutomationRuleAction",
  "AutomationRule",
  "AutomationRuleRun",
  "CreateAutomationRuleRequest",
  "UpdateAutomationRuleRequest",
  "AutomationRulesResponse",
  "AutomationRuleResponse",
  "AutomationRuleRunResponse",
  "BulkMacroStepType",
  "BulkMacroWorkflowStatus",
  "BulkMacroStep",
  "BulkMacroTarget",
  "BulkMacro",
  "CreateBulkMacroRequest",
  "UpdateBulkMacroRequest",
  "BulkMacroTargetsRequest",
  "RunBulkMacroRequest",
  "BulkMacroPreview",
  "BulkMacroRun",
  "BulkMacrosResponse",
  "BulkMacroResponse",
  "BulkMacroPreviewResponse",
  "BulkMacroRunResponse",
  "BulkMacroRunsResponse",
  "DrProbe",
  "DrProbeResponse",
  "SystemMetrics",
  "SystemStatusResponse",
  "SystemControlResponse",
  "AccountExport",
  "AccountExportResponse"
]) {
  assert.ok(contract.components?.schemas?.[schemaName], `API contract should define ${schemaName}`);
}

const previewScenarios = contract.paths?.["/safety-preview/scenarios"]?.get;
assert.equal(previewScenarios?.operationId, "safetyPreviewScenarios");
assert.deepEqual(previewScenarios?.security, [{ bearerAuth: [] }, { cookieAuth: [] }]);
assert.equal(previewScenarios?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SafetyPreviewScenariosResponse");
assert.ok(previewScenarios?.responses?.["403"], "Safety preview scenarios should document editor authorization");
for (const status of ["401", "403"]) {
  assert.equal(previewScenarios?.responses?.[status]?.$ref, "#/components/responses/SafetyPreviewError");
}

const previewRun = contract.paths?.["/safety-preview/run"]?.post;
assert.equal(previewRun?.operationId, "runSafetyPreview");
assert.deepEqual(previewRun?.security, [{ bearerAuth: [] }, { cookieAuth: [] }]);
assert.equal(previewRun?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SafetyPreviewRunRequest");
assert.equal(previewRun?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SafetyPreviewRunResponse");
assert.ok(previewRun?.responses?.["403"], "Safety preview run should document editor authorization");
for (const status of ["401", "403", "422"]) {
  assert.equal(previewRun?.responses?.[status]?.$ref, "#/components/responses/SafetyPreviewError");
}

const previewSchemas = contract.components.schemas;
assert.deepEqual(previewSchemas.SafetyPreviewScenario.enum, ["bulk-delete-basic", "restore-conflict"]);
assert.deepEqual(previewSchemas.SafetyPreviewOperation.enum, ["delete", "restore"]);
assert.deepEqual(previewSchemas.SafetyPreviewRunRequest.required, ["scenario", "operation", "ids"]);
assert.equal(previewSchemas.SafetyPreviewRunRequest.properties.ids.minItems, 1);
assert.equal(previewSchemas.SafetyPreviewRunRequest.properties.ids.maxItems, 10000);
assert.equal(previewSchemas.SafetyPreviewScenarioDescriptor.properties.description.type, "string");
assert.equal(previewSchemas.SafetyPreviewScenariosResponse.allOf[0].$ref, "#/components/schemas/OkEnvelope");
assert.equal(previewSchemas.SafetyPreviewScenariosResponse.allOf[1].properties.synthetic.const, true);
assert.equal(previewSchemas.SafetyPreviewRunResponse.allOf[0].$ref, "#/components/schemas/OkEnvelope");
assert.equal(previewSchemas.SafetyPreviewRunResponse.allOf[1].properties.synthetic.const, true);
assert.equal(previewSchemas.SafetyPreviewRunResponse.allOf[1].properties.expiresAt.format, "date-time");
assert.equal(previewSchemas.SafetyPreviewError.allOf[0].$ref, "#/components/schemas/ErrorEnvelope");
assert.equal(previewSchemas.SafetyPreviewError.allOf[1].properties.synthetic.const, true);

const bulkMacroPaths = contract.paths;
const bulkMacroSchemas = contract.components.schemas;
for (const operation of [
  bulkMacroPaths["/bulk-macros"]?.get,
  bulkMacroPaths["/bulk-macros"]?.post,
  bulkMacroPaths["/bulk-macros/{id}"]?.get,
  bulkMacroPaths["/bulk-macros/{id}"]?.patch,
  bulkMacroPaths["/bulk-macros/{id}"]?.delete,
  bulkMacroPaths["/bulk-macros/{id}/preview"]?.post,
  bulkMacroPaths["/bulk-macros/{id}/run"]?.post,
  bulkMacroPaths["/bulk-macros/{id}/runs"]?.get
]) {
  assert.deepEqual(operation?.security, [{ bearerAuth: [] }, { cookieAuth: [] }]);
  assert.ok(operation?.responses?.["401"], "Bulk macro endpoints should document authentication");
  assert.ok(operation?.responses?.["403"], "Bulk macro endpoints should document editor authorization");
}
assert.equal(bulkMacroPaths["/bulk-macros"]?.post?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BulkMacroResponse");
assert.equal(bulkMacroPaths["/bulk-macros/{id}/preview"]?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BulkMacroPreviewResponse");
assert.equal(bulkMacroPaths["/bulk-macros/{id}/run"]?.post?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BulkMacroRunResponse");
assert.equal(bulkMacroPaths["/bulk-macros/{id}/runs"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BulkMacroRunsResponse");
assert.equal(bulkMacroPaths["/bulk-macros/{id}/run"]?.post?.responses?.["422"]?.$ref, "#/components/responses/BulkMacroPreviewError");
assert.deepEqual(bulkMacroSchemas.BulkMacroStepType.enum, ["add-tag", "set-workflow-status", "delete"]);
assert.deepEqual(bulkMacroSchemas.BulkMacroWorkflowStatus.enum, ["draft", "editing", "review", "approved", "published", "archived"]);
assert.deepEqual(bulkMacroSchemas.CreateBulkMacroRequest.required, ["name", "steps"]);
assert.equal(bulkMacroSchemas.CreateBulkMacroRequest.properties.name.maxLength, 200);
assert.equal(bulkMacroSchemas.CreateBulkMacroRequest.properties.steps.minItems, 1);
assert.equal(bulkMacroSchemas.CreateBulkMacroRequest.properties.steps.maxItems, 10);
assert.equal(bulkMacroSchemas.BulkMacroTargetsRequest.properties.targets.minItems, 1);
assert.equal(bulkMacroSchemas.BulkMacroTargetsRequest.properties.targets.maxItems, 1000);
assert.deepEqual(bulkMacroSchemas.BulkMacroPreviewError.allOf[1].properties.code.enum, ["invalid_preview", "expired_preview", "stale_preview"]);
assert.equal(bulkMacroSchemas.BulkMacroNotFoundError.allOf[1].properties.code.const, "not_found");

assert.ok(contract.components?.securitySchemes?.bearerAuth, "API contract should define bearer auth");
assert.ok(contract.components?.securitySchemes?.cookieAuth, "API contract should define cookie auth");

console.log("ok - api contracts");

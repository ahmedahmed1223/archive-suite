import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const contract = readJson("docs/api/archive-contract.openapi.json");

assert.equal(contract.openapi, "3.1.0", "API contract should use OpenAPI 3.1.0");
assert.equal(contract.info?.title, "Archive Suite API Contract", "API contract title should be stable");

for (const pathName of [
  "/health",
  "/auth/login",
  "/auth/me",
  "/auth/refresh",
  "/auth/logout",
  "/records",
  "/records/bulk",
  "/records/{id}/notes",
  "/record-notes/{id}",
  "/search",
  "/discover",
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
  "/share",
  "/share/{token}",
  "/records/bulk-delete",
  "/users",
  "/users/{id}",
  "/invitations/{token}/accept",
  "/system/security-settings",
  "/system/backups",
  "/system/backups/run",
  "/system/backups/preview",
  "/system/backups/restore"
]) {
  assert.ok(contract.paths?.[pathName], `API contract should include ${pathName}`);
}

for (const schemaName of [
  "OkEnvelope",
  "ErrorEnvelope",
  "AuthResponse",
  "User",
  "ArchiveRecord",
  "RecordNoteRegion",
  "RecordNote",
  "RecordNoteCreateRequest",
  "RecordNoteUpdateRequest",
  "RecordNotesResponse",
  "RecordNoteResponse",
  "DiscoverSection",
  "DiscoverResponse",
  "RelationType",
  "RelationTypeOption",
  "RecordRelation",
  "RelationGraphNode",
  "RelationGraphEdge",
  "RelationGraphStats",
  "RelationGraphResponse",
  "CreateRecordRelationRequest",
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
  "UserAccount",
  "UserInvitation",
  "InviteUserRequest",
  "AcceptInvitationRequest",
  "SecuritySettings",
  "BackupInfo",
  "BackupListResponse",
  "BackupPreviewResponse",
  "BackupRestoreResponse"
]) {
  assert.ok(contract.components?.schemas?.[schemaName], `API contract should define ${schemaName}`);
}

assert.ok(contract.components?.securitySchemes?.bearerAuth, "API contract should define bearer auth");
assert.ok(contract.components?.securitySchemes?.cookieAuth, "API contract should define cookie auth");

console.log("ok - api contracts");

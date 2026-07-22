import contract from "../../docs/api/archive-contract.openapi.json";
import type { components as GeneratedApiComponents } from "./generated/archive-api";

export const ARCHIVE_UNAUTHORIZED_EVENT = "archive-next:unauthorized";

export type ApiEnvelope<T extends object = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; details?: unknown };

export interface ArchiveUser {
  id: string;
  username?: string;
  role?: "admin" | "editor" | "viewer";
  roles?: string[];
  name?: string;
  displayName?: string;
  email?: string;
  totpEnabled?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  user: ArchiveUser;
  accessToken: string;
  expiresAt: string;
}

export interface DescriptorCompletion {
  status: "green" | "yellow" | "red";
  complete: number;
  total: number;
  missing: Array<"title" | "description" | "type" | "tags">;
}

type GeneratedSchemas = GeneratedApiComponents["schemas"];

export type ArchiveRecord = GeneratedSchemas["ArchiveRecord"];
export type RecordAttachment = GeneratedSchemas["RecordAttachment"];
export type CreateRecordPayload = Omit<GeneratedSchemas["RecordCreateRequest"], "store"> & { store?: string };

export type ScheduledUploadStatus = GeneratedSchemas["ScheduledUploadStatus"];
export type ScheduledUpload = GeneratedSchemas["ScheduledUpload"];
export type ScheduledUploadStaged = GeneratedSchemas["ScheduledUploadStaged"];
export type SafetyPreviewScenario = GeneratedSchemas["SafetyPreviewScenario"];
export type SafetyPreviewScenarioDescriptor = GeneratedSchemas["SafetyPreviewScenarioDescriptor"];
export type SafetyPreviewOperation = GeneratedSchemas["SafetyPreviewOperation"];
export type SafetyPreviewRun = GeneratedSchemas["SafetyPreviewRunResponse"];
export type SafetyPreviewRunPayload = GeneratedSchemas["SafetyPreviewRunRequest"];

export interface CreateScheduledUploadPayload {
  uploadSessionId: string;
  scheduledAt: string;
  timeZone: string;
  idempotencyKey: string;
  record: Pick<ArchiveRecord, "title" | "type" | "subtype" | "tags" | "metadata">;
}

export interface RescheduleUploadRequest {
  scheduledAt: string;
  timeZone: string;
  version: number;
}

export interface SearchSuggestion {
  kind: "record" | "tag" | "type" | "recent";
  label: string;
  value: string;
  recordId?: string;
}

export interface PublicCatalogRecord {
  id: string;
  uid: string;
  title: string;
  description?: string | null;
  type?: string | null;
  subtype?: string | null;
  tags: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type PluginPermissionRisk = "low" | "medium" | "high" | string;
export type PluginStatus = "reviewed" | "draft" | "blocked" | string;
export type PluginCategory = "metadata" | "workflow" | "ai" | "integration" | string;

export interface PluginRuntimePolicy {
  mode: string;
  allowsRemoteInstall: boolean;
  allowsCodeExecution: boolean;
  requiresAdminReview: boolean;
  description: string;
}

export interface PluginPermission {
  scope: string;
  risk: PluginPermissionRisk;
  reason: string;
}

export interface PluginSecurityReview {
  networkAccess: boolean;
  fileSystemAccess: boolean;
  executesCode: boolean;
  dataLeavesTenant: boolean;
  adminApprovalRequired: boolean;
}

export interface PluginCatalogItem {
  id: string;
  name: string;
  vendor: string;
  version: string;
  category: PluginCategory;
  summary: string;
  status: PluginStatus;
  trustLevel: string;
  permissions: PluginPermission[];
  securityReview: PluginSecurityReview;
}

export interface PluginPermissionScopeSummary {
  scope: string;
  risk: PluginPermissionRisk;
  pluginCount: number;
}

export interface RecordListPayload {
  records: ArchiveRecord[];
  nextCursor?: string | null;
}

export interface SearchFacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  mode: "keyword" | "keyword-fallback" | "semantic" | string;
  store?: string | null;
  total?: number;
  stores?: SearchFacetBucket[];
  types?: SearchFacetBucket[];
  subtypes?: SearchFacetBucket[];
  tags?: SearchFacetBucket[];
  statuses?: SearchFacetBucket[];
  [key: string]: unknown;
}

/** Records don't carry a guaranteed file path — only ingested/uploaded metadata does. */
export function deriveRecordSourcePath(record: ArchiveRecord): { sourcePath: string; disk?: string } | null {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const sourcePath = metadata["filePath"] ?? metadata["path"];
  if (typeof sourcePath !== "string" || !sourcePath.trim()) return null;
  const disk = metadata["disk"];
  return { sourcePath, ...(typeof disk === "string" && disk.trim() ? { disk } : {}) };
}

export type DiscoverSectionKey = "explore" | "trending" | "random" | "active" | "forgotten" | "needsMetadata";

export interface DiscoverSection {
  key: DiscoverSectionKey;
  label: string;
  description: string;
  count: number;
  records: ArchiveRecord[];
}

export type SuggestionContext = "discover" | "search" | "detail";
export type SuggestionFeedbackValue = "useful" | "not-useful" | "dismissed";

export interface ArchiveSuggestion {
  key: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | string;
  count: number;
  actionHref: string;
}

export interface ArchiveSuggestionFeedback {
  key: string;
  context: SuggestionContext;
  value: SuggestionFeedbackValue;
  updatedAt?: string | null;
}

export type RelationTypeKey =
  | "is_part_of"
  | "contains"
  | "references"
  | "depends_on"
  | "related_to"
  | "alternative_of"
  | "copy_of"
  | "precedes"
  | "follows";

export interface RelationTypeOption {
  key: RelationTypeKey;
  label: string;
  inverse: string;
  bidirectional: boolean;
}

export interface RecordRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationTypeKey;
  label: string;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RelationGraphNode {
  id: string;
  uid?: string;
  label: string;
  kind: "item";
  type: string;
  tags: string[];
  degree: number;
  record?: ArchiveRecord;
}

export type RelationGraphEdgeKind = "manual" | "shared-tag" | "same-type";

export interface RelationGraphEdge {
  id: string;
  relationId?: string;
  source: string;
  target: string;
  kind: RelationGraphEdgeKind;
  type: string;
  label: string;
  weight: number;
  note?: string | null;
  sharedTags?: string[];
  sharedType?: string;
}

export interface RelationGraphStats {
  nodeCount: number;
  edgeCount: number;
  manualEdgeCount: number;
  inferredEdgeCount: number;
  focusId?: string | null;
}

export interface RelationGraphPayload {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  stats: RelationGraphStats;
  relationTypes: RelationTypeOption[];
}

export interface CreateRelationPayload {
  sourceId: string;
  targetId: string;
  type: RelationTypeKey;
  note?: string;
}

export interface UpdateRelationPayload {
  type?: RelationTypeKey;
  note?: string | null;
}

export interface RecordNoteRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RecordNote {
  id: string;
  itemId: string;
  body: string;
  timestampSeconds: number | null;
  region: RecordNoteRegion | null;
  authorId: string | null;
  authorName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateRecordNotePayload {
  body: string;
  timestampSeconds?: number | null;
  region?: RecordNoteRegion | null;
}

export type UpdateRecordNotePayload = Partial<CreateRecordNotePayload>;

export interface RecordComment {
  id: string;
  itemId: string;
  body: string;
  authorId: string | null;
  authorName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateRecordCommentPayload {
  body: string;
}

export interface IntakeTemplate {
  id: string;
  name: string;
  type: string | null;
  fields: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateIntakeTemplatePayload {
  name: string;
  type?: string;
  fields: Record<string, unknown>;
}

export type ImportSuggestedType = "video" | "image" | "audio" | "document" | "file";

export interface ImportPreview {
  url: string;
  contentType: string;
  contentLength: number | null;
  suggestedType: ImportSuggestedType;
  suggestedTitle: string;
}

export interface UploadLink {
  id: string;
  token?: string;
  label: string | null;
  folder: string | null;
  expiresAt: string;
  revoked: boolean;
  uploadCount: number;
  createdAt: string | null;
}

export interface CreateUploadLinkPayload {
  label?: string;
  folder?: string;
  expiresInHours: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string | null;
  filters: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
  ownerId?: string;
  shared?: boolean;
  canManage?: boolean;
}

export interface CreateSavedSearchPayload {
  name: string;
  query?: string;
  filters?: Record<string, unknown>;
}

export interface Collection {
  id: string;
  name: string;
  query: string | null;
  type: string;
  tag: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateCollectionPayload {
  name: string;
  query?: string;
  type?: string;
  tag?: string;
}

export type InboxStatus = "new" | "triage" | "ready" | "done";

export interface InboxItem {
  id: string;
  title: string;
  source: string | null;
  note: string | null;
  status: InboxStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateInboxItemPayload {
  title: string;
  source?: string;
  note?: string;
  status?: InboxStatus;
}

export interface UpdateInboxItemPayload {
  title?: string;
  source?: string | null;
  note?: string | null;
  status?: InboxStatus;
}

export type VocabularyKind = "type" | "tag" | "custom";

export interface VocabularyTerm {
  id: string;
  term: string;
  kind: VocabularyKind;
  aliases: string | null;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateVocabularyTermPayload {
  term: string;
  kind?: VocabularyKind;
  aliases?: string;
  note?: string;
}

export interface TagNode {
  id: string;
  tag: string;
  parent: string;
  color?: string | null;
  order?: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTagNodePayload {
  tag: string;
  parent: string;
  color?: string;
  order_index?: number;
}

export interface UpdateTagNodePayload {
  tag?: string;
  parent?: string;
  color?: string | null;
  order_index?: number;
}

export type AutomationRuleTrigger = "record.created" | "record.updated" | "media.failed" | "schedule.daily";
export type AutomationRuleAction = "add-tag" | "set-review" | "notify-admin" | "create-inbox-item";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationRuleTrigger;
  query: string;
  type: string;
  tag: string;
  status: string;
  action: AutomationRuleAction;
  enabled: boolean;
  lastRunAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AutomationRuleRun {
  id: string;
  ruleId: string;
  status: "completed" | "failed" | string;
  dryRun: boolean;
  matchedCount: number;
  executedCount: number;
  message?: string | null;
  sampleRecords?: Array<{ id: string; title: string }>;
  createdAt?: string | null;
}

export interface CreateAutomationRulePayload {
  name: string;
  trigger: AutomationRuleTrigger;
  query?: string;
  type?: string;
  tag?: string;
  status?: string;
  action: AutomationRuleAction;
  enabled?: boolean;
}

export type UpdateAutomationRulePayload = Partial<CreateAutomationRulePayload>;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RecordHistoryEntry {
  id: number | string;
  event: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  actorId: string | null;
  outcome: string;
  statusCode: number;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface ActivityFilters {
  event?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: "success" | "rejected" | "failed" | "";
  limit?: number;
  page?: number;
}

export interface ComplianceReportFilters {
  from?: string;
  to?: string;
  event?: string;
  resourceType?: string;
  outcome?: "success" | "rejected" | "failed" | "";
  limit?: number;
}

export interface ComplianceReportEntry {
  id: number | string;
  event: string;
  resourceType: string | null;
  resourceId: string | null;
  actorId: string | null;
  outcome: "success" | "rejected" | "failed";
  statusCode: number;
  action: string;
  createdAt: string | null;
}

export interface ComplianceReportSummary {
  total: number;
  outcomes: Record<"success" | "rejected" | "failed", number>;
  events: Record<string, number>;
  resourceTypes: Record<string, number>;
}

export interface SyncLogEntry {
  uid: string;
  store: string;
  status: "synced" | "conflict";
  syncVersion: number | null;
  lastModifiedBy: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface SyncSummary {
  total: number;
  synced: number;
  conflicts: number;
}

export interface ArchiveFile {
  key: string;
  name?: string;
  size?: number;
  modifiedAt?: string;
  store?: string;
  [key: string]: unknown;
}

export interface RightsRecord {
  id: string;
  itemId: string;
  rightsHolder: string;
  licenseType: "OWNED" | "LICENSED" | "PUBLIC_DOMAIN" | "FAIR_USE" | "UNKNOWN";
  embargoStart?: string | null;
  embargoEnd?: string | null;
  expiresAt?: string | null;
  geoRestrictions?: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RightsEnforcementStatus {
  allowed: boolean;
  blocked?: boolean;
  reason?: string;
  warnings?: string[];
  record?: RightsRecord;
}

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
  checksum: string | null;
}

export interface BackupRunResult {
  name: string;
  sizeBytes: number;
  stores: Record<string, number>;
  completedAt: string;
  checksum: string;
}

export interface BackupPreview {
  name: string;
  stores: Record<string, number>;
  totalRecords: number;
}

export interface BackupRestoreResult {
  name: string;
  counts: Record<string, number>;
  restoredAt: string;
  verified: boolean;
}

export interface BackupVerification {
  name: string;
  checksum: string;
  verified: boolean;
  message: string;
}

export interface DrDrillResult {
  status: string;
  message: string;
  latestBackupName: string | null;
  drillAt: string;
  passed: boolean;
}

export interface DrDrillStatus {
  status: string;
  message: string;
  latestBackupName: string | null;
  drillAt: string | null;
  passed: boolean | null;
}

export interface DrProbe {
  lastBackupAt: string | null;
  lastBackupName: string | null;
  lastRestoreTestAt: string | null;
  lastRestoreTestOk: boolean | null;
}

/**
 * V1-760: raw per-queue counters as the API reports them. Structurally a
 * `QueueSnapshot` (lib/queue-health.ts), which turns these into a verdict —
 * kept separate so the transport shape and the judgement stay independent.
 */
export interface QueueMetrics {
  name: string;
  depth: number;
  failed: number;
  /** Age of the oldest pending job; 0 when idle. Separates a stalled queue from a busy one. */
  oldestJobAgeSec: number;
}

/**
 * V1-756: one point in the storage history. Structurally the `StorageSample`
 * that lib/storage-forecast.ts fits a trend to; `totalBytes` supplies the
 * capacity the exhaustion date is measured against.
 */
export interface StorageSample {
  at: string;
  usedBytes: number;
  totalBytes: number;
}

export interface SystemMetrics {
  cpuLoad: number[];
  memory: { usedBytes: number; totalBytes: number };
  disk: { usedBytes: number; totalBytes: number };
  queueDepth: number;
  /** V1-760: per-queue breakdown. `queueDepth` is the sum of every `depth`. */
  queues: QueueMetrics[];
}

export type SystemControlAction = "clear-cache" | "run-backup";

export interface SystemControlResult {
  action: string;
  detail: Record<string, unknown>;
}

export interface AccountExport {
  user: Record<string, unknown>;
  savedSearches: Record<string, unknown>[];
  recordNotes: Record<string, unknown>[];
  recordComments: Record<string, unknown>[];
  uploadLinks: Record<string, unknown>[];
  intakeTemplates: Record<string, unknown>[];
  exportedAt: string;
}

export interface BulkDeleteResultItem {
  uid: string;
  deleted: boolean;
}

/** V1-731: a record moved to the trash by bulkDeleteRecords. */
export interface TrashEntry {
  /** Trash entry id, not the record id. */
  id: number;
  store: string;
  uid: string;
  record: ArchiveRecord;
  syncVersion: number | null;
  deletedAt: string;
  deletedBy: number | null;
  originalCreatedAt: string | null;
  originalUpdatedAt: string | null;
}

export interface TrashRestoreResultItem {
  uid: string;
  restored: boolean;
  /** Present only when restored is false. */
  reason?: "not_found" | "conflict";
}

export interface TrashPurgeResultItem {
  uid: string;
  purged: boolean;
}

export interface TrashFilters {
  store?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface FileBrowserEntry {
  key: string;
  name: string;
  kind: "file" | "folder";
  path?: string;
  mimeType?: string;
  size?: number;
  modifiedAt?: string;
  url?: string;
  [key: string]: unknown;
}

export interface FtpPullPayload {
  host: string;
  port?: number;
  user: string;
  password: string;
  remotePath?: string;
  localPath?: string;
  secure?: boolean;
}

export interface SmbPullPayload {
  share: string;
  path?: string;
  user: string;
  password: string;
  domain?: string;
  localPath?: string;
}

export type MediaOperation = "thumbnail" | "transcode" | "transcription" | "ocr" | "montage_export";
export type MediaJobStatus = "queued" | "processing" | "completed" | "failed" | "canceled";

export interface MediaJob {
  id: string;
  recordId: string;
  operation: MediaOperation;
  status: MediaJobStatus;
  sourcePath?: string | null;
  options?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  progressStage?: string | null;
  progressPercent?: number | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CreateMediaJobPayload {
  recordId: string;
  operation: MediaOperation;
  sourcePath?: string;
  options?: Record<string, unknown>;
}

export interface BroadcastMetadata {
  itemId: string;
  mosObjectId?: string | null;
  mosProgramId?: string | null;
  mxfUmid?: string | null;
  mxfFormat?: string | null;
  raw?: Record<string, unknown> | null;
  updatedAt?: string | null;
}

export interface BroadcastMetadataPayload {
  mosObjectId?: string | null;
  mosProgramId?: string | null;
  mxfUmid?: string | null;
  mxfFormat?: string | null;
  raw?: Record<string, unknown>;
}

export interface UploadedRecord {
  id: string;
  uid?: string;
  title: string;
  fileName: string;
  filePath: string;
  checksum: string;
  source: "upload";
  createdAt?: string;
  updatedAt?: string;
}

/** V1-711: resumable chunked upload session state. */
export interface UploadSession {
  id: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  status: "pending" | "completed" | "aborted";
  expiresAt: string;
}

export type ManagedUserRole = "admin" | "editor" | "viewer";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: ManagedUserRole;
  createdAt?: string;
}

export interface MentionableUser {
  id: string;
  name: string;
}

export interface DelegatedAccessParty {
  id: number;
  name?: string;
  email?: string;
}

export interface DelegatedAccess {
  id: string;
  grantor: DelegatedAccessParty;
  grantee: DelegatedAccessParty;
  scope: { itemIds?: string[] };
  permission: string;
  expiresAt?: string;
  revokedAt?: string | null;
  status: "active" | "expired" | "revoked";
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: ManagedUserRole;
  expiresAt: string;
  createdAt?: string;
}

export interface ContentField {
  id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "relation" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface ContentSubtype {
  id: string;
  name: string;
  fields?: ContentField[];
}

export interface ContentTypeRecord {
  uid: string;
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  active?: boolean;
  subtypes: ContentSubtype[];
  fields: ContentField[];
  updatedAt?: string;
}

export type ArchiveTypeFieldKind = "text" | "number" | "date" | "select" | "multi" | "boolean";

export interface ArchiveTypeFieldCondition {
  field: string;
  equals: string | number | boolean;
}

export type OnboardingStageId = "organization" | "storage" | "invitation" | "first_record" | "first_search";

export interface OnboardingStage {
  id: OnboardingStageId;
  status: "pending" | "completed";
  completedAt: string | null;
}

export interface OnboardingProgress {
  stages: OnboardingStage[];
}

export interface ArchiveTypeField {
  name: string;
  type: ArchiveTypeFieldKind;
  condition?: ArchiveTypeFieldCondition;
  fieldAcl?: {
    view?: string[] | null;
    edit?: string[] | null;
  } | null;
}

/** A configurable schema stored by the Laravel types endpoint. */
export interface ArchiveType {
  id: string;
  name: string;
  icon?: string;
  fields: ArchiveTypeField[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SecuritySettings {
  accessTokenTtlMinutes: number;
  perUserRateLimit: number;
  webhookUrlAllowlist: string[];
  legacyPasswordUpgrade: boolean;
  cspPolicy: string;
  corsOrigins: string[];
}

export type OdbcProbeStatus = "disabled" | "missing-dsn" | "driver-unavailable" | "connected" | "failed";

export interface OdbcProbe {
  enabled: boolean;
  driverLoaded: boolean;
  dsn: string;
  status: OdbcProbeStatus;
  message?: string;
  error?: string;
  tables: string[];
}

export interface OdbcTablePreview {
  table: string;
  count: number;
  rows: Record<string, unknown>[];
}

export interface StorageConnectionResult {
  status: "connected" | "disconnected";
  driver: "local" | "s3";
  message: string;
  bucket?: string;
  region?: string;
  testedAt: string;
}

export interface DatabaseConnectionResult {
  status: "connected" | "disconnected";
  driver: "mysql" | "pgsql" | "sqlite";
  database: string;
  message: string;
  testedAt: string;
}

export type OdbcWriteOperation = "insert" | "update" | "delete";

export interface OdbcWriteResult {
  table: string;
  operation: OdbcWriteOperation;
  affected: number;
}

export interface ReviewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReviewComment {
  id: string;
  mediaUid: string;
  timecodeSeconds: number;
  author: string;
  body: string;
  annotation?: ReviewRect[] | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReviewLinkPermission = "view" | "comment";

export interface ReviewLinkMetadata {
  permission: ReviewLinkPermission;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewLinkDetails {
  mediaUid: string;
  review: ReviewLinkMetadata;
  comments: ReviewComment[];
}

export type CollaborationStatus = "active" | "viewing" | "reviewing" | "editing" | "idle";

export interface CollaborationParticipant {
  id: string;
  roomKey: string;
  userId: string;
  displayName: string;
  status: CollaborationStatus;
  resourceId?: string | null;
  cursor?: Record<string, unknown> | null;
  lastSeenAt?: string | null;
}

export interface CollaborationPresencePayload {
  roomKey: string;
  activeWindowSeconds: number;
  participants: CollaborationParticipant[];
}

export interface CollaborationLock {
  id: string;
  roomKey: string;
  resourceId: string;
  userId: string;
  displayName: string;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface CollaborationLocksPayload {
  roomKey: string;
  locks: CollaborationLock[];
}

export interface CollaborationDocument {
  roomKey: string;
  resourceId: string;
  content: string;
  version: number;
  updatedByDisplayName?: string | null;
  updatedAt?: string | null;
}

export interface ArchiveApiClient {
  health(): Promise<ApiEnvelope<{ backend: string; engine: string; uptimeSec: number }>>;
  login(payload: LoginRequest): Promise<ApiEnvelope<AuthSession>>;
  me(options?: AuthRequestOptions): Promise<ApiEnvelope<{ user: ArchiveUser }>>;
  refresh(): Promise<ApiEnvelope<AuthSession>>;
  logout(options?: AuthRequestOptions): Promise<ApiEnvelope>;
  search(
    params: { q?: string; store?: string; type?: string; subtype?: string; tag?: string; status?: string; cursor?: string; limit?: number; mode?: "keyword" | "semantic" | "transcript" },
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ records: ArchiveRecord[]; facets?: SearchFacets; nextCursor?: string | null }>>;
  searchSuggestions(params: { q: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ suggestions: SearchSuggestion[] }>>;
  publicCatalog(params?: { q?: string; type?: string; tag?: string; cursor?: string; limit?: number }): Promise<ApiEnvelope<{ records: PublicCatalogRecord[]; nextCursor?: string | null }>>;
  plugins(params?: { status?: string; category?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ runtimePolicy: PluginRuntimePolicy; plugins: PluginCatalogItem[]; permissionScopes: PluginPermissionScopeSummary[] }>>;
  discover(params?: { limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ sections: DiscoverSection[] }>>;
  suggestions(params: { context: SuggestionContext; recordId?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ context: SuggestionContext; suggestions: ArchiveSuggestion[] }>>;
  submitSuggestionFeedback(key: string, payload: { value: SuggestionFeedbackValue; context?: SuggestionContext }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ feedback: ArchiveSuggestionFeedback }>>;
  relationGraph(params?: { recordId?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<RelationGraphPayload>>;
  createRelation(payload: CreateRelationPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ relation: RecordRelation }>>;
  updateRelation(id: string, payload: UpdateRelationPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ relation: RecordRelation }>>;
  deleteRelation(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  recordNotes(recordId: string, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ notes: RecordNote[] }>>;
  createRecordNote(recordId: string, payload: CreateRecordNotePayload, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ note: RecordNote }>>;
  updateRecordNote(id: string, payload: UpdateRecordNotePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ note: RecordNote }>>;
  deleteRecordNote(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  recordComments(recordId: string, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comments: RecordComment[] }>>;
  createRecordComment(recordId: string, payload: CreateRecordCommentPayload, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: RecordComment }>>;
  deleteRecordComment(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  activity(params?: ActivityFilters, options?: AuthRequestOptions): Promise<ApiEnvelope<{ entries: RecordHistoryEntry[]; filters: ActivityFilters; pagination?: PaginationMeta }>>;
  complianceReport(params?: ComplianceReportFilters, options?: AuthRequestOptions): Promise<ApiEnvelope<{ entries: ComplianceReportEntry[]; filters: ComplianceReportFilters; summary: ComplianceReportSummary }>>;
  downloadComplianceReport(params?: ComplianceReportFilters, options?: AuthRequestOptions): Promise<ApiEnvelope<{ blob: Blob; filename: string }>>;
  recordHistory(recordId: string, params?: { limit?: number; page?: number; store?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ entries: RecordHistoryEntry[]; pagination?: PaginationMeta }>>;
  sync(params?: { limit?: number; page?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ entries: SyncLogEntry[]; summary: SyncSummary; pagination?: PaginationMeta }>>;
  record(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: ArchiveRecord }>>;
  createRecord(payload: CreateRecordPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: ArchiveRecord }>>;
  recordAttachments(id: string, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ attachments: RecordAttachment[] }>>;
  uploadRecordAttachments(id: string, files: File[], store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ attachments: RecordAttachment[] }>>;
  deleteRecordAttachment(id: string, attachmentId: string, store?: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  updateRecordTranscript(id: string, payload: { transcript: string; store?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: ArchiveRecord }>>;
  records(params: { store: string; cursor?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<RecordListPayload>>;
  types(params?: { cursor?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ types: ArchiveType[]; nextCursor?: string | null }>>;
  type(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ type: ArchiveType }>>;
  saveType(payload: ArchiveType, options?: AuthRequestOptions): Promise<ApiEnvelope<{ type: ArchiveType }>>;
  deleteType(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted?: boolean }>>;
  bulkRecords(payload: { store: string; records: ArchiveRecord[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ count: number }>>;
  bulkDeleteRecords(payload: { store: string; ids: string[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ count: number; results: BulkDeleteResultItem[] }>>;
  safetyPreviewScenarios(options?: AuthRequestOptions): Promise<ApiEnvelope<GeneratedSchemas["SafetyPreviewScenariosResponse"]>>;
  runSafetyPreview(payload: SafetyPreviewRunPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<SafetyPreviewRun>>;
  trash(params?: TrashFilters, options?: AuthRequestOptions): Promise<ApiEnvelope<{ items: TrashEntry[]; pagination?: PaginationMeta }>>;
  restoreTrash(payload: { store: string; ids: string[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ count: number; results: TrashRestoreResultItem[] }>>;
  purgeTrash(payload: { store: string; ids: string[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ count: number; results: TrashPurgeResultItem[] }>>;
  rights(itemId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  upsertRights(payload: Omit<RightsRecord, "id" | "createdAt" | "updatedAt">, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  expiringRights(params?: { days?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ records: RightsRecord[] }>>;
  rightsEnforcement(itemId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<RightsEnforcementStatus>>;
  listBackups(options?: AuthRequestOptions): Promise<ApiEnvelope<{ backups: BackupInfo[] }>>;
  runBackup(options?: AuthRequestOptions): Promise<ApiEnvelope<{ backup: BackupRunResult }>>;
  previewBackup(payload: { name: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ preview: BackupPreview }>>;
  restoreBackup(payload: { name: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ result: BackupRestoreResult }>>;
  verifyBackup(payload: { name: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ verification: BackupVerification }>>;
  runDrDrill(options?: AuthRequestOptions): Promise<ApiEnvelope<{ result: DrDrillResult }>>;
  getDrDrillStatus(options?: AuthRequestOptions): Promise<ApiEnvelope<{ status: DrDrillStatus }>>;
  systemStatus(options?: AuthRequestOptions): Promise<ApiEnvelope<{ metrics: SystemMetrics; dr: DrProbe }>>;
  systemMetricsHistory(params?: { days?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ samples: StorageSample[] }>>;
  drProbe(options?: AuthRequestOptions): Promise<ApiEnvelope<{ dr: DrProbe }>>;
  runSystemControlAction(action: SystemControlAction, options?: AuthRequestOptions): Promise<ApiEnvelope<{ result: SystemControlResult }>>;
  exportAccountData(options?: AuthRequestOptions): Promise<ApiEnvelope<{ export: AccountExport }>>;
  browseFiles(params?: { path?: string; query?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ path: string; entries: FileBrowserEntry[] }>>;
  ingestFtpPull(payload: FtpPullPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ ingested: unknown[]; skipped: number }>>;
  ingestSmbPull(payload: SmbPullPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ ingested: unknown[]; skipped: number }>>;
  mediaJob(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  mediaJobs(params?: { status?: MediaJobStatus; recordId?: string; limit?: number; page?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ jobs: MediaJob[]; pagination?: PaginationMeta }>>;
  createMediaJob(payload: CreateMediaJobPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  cancelMediaJob(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  broadcastMetadata(recordId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ configured: boolean; integrations: { mos: boolean; mxf: boolean }; metadata: BroadcastMetadata | null }>>;
  updateBroadcastMetadata(recordId: string, payload: BroadcastMetadataPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ configured: boolean; integrations: { mos: boolean; mxf: boolean }; metadata: BroadcastMetadata | null }>>;
  ingestScan(payload?: { subdir?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ ingested: unknown[]; skipped: number }>>;
  uploadFile(file: File, params?: { folder?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: UploadedRecord }>>;
  createUploadSession(
    payload: { fileName: string; totalSize: number; chunkSize: number; folder?: string; checksum?: string },
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ session: UploadSession }>>;
  uploadSessionChunk(
    sessionId: string,
    index: number,
    chunk: Blob,
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ receivedChunks: number[]; totalChunks: number }>>;
  uploadSessionStatus(sessionId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ session: UploadSession }>>;
  completeUploadSession(sessionId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: UploadedRecord }>>;
  abortUploadSession(sessionId: string, options?: AuthRequestOptions): Promise<ApiEnvelope>;
  scheduledUploads(params?: { cursor?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedules: ScheduledUpload[]; nextCursor?: string | null }>>;
  scheduledUpload(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedule: ScheduledUpload }>>;
  createScheduledUpload(payload: CreateScheduledUploadPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedule: ScheduledUploadStaged }>>;
  rescheduleScheduledUpload(id: string, payload: RescheduleUploadRequest, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedule: ScheduledUpload }>>;
  cancelScheduledUpload(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedule: ScheduledUpload }>>;
  retryScheduledUpload(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ schedule: ScheduledUpload }>>;
  share(token: string, password?: string): Promise<ApiEnvelope<{ records: ArchiveRecord[]; scope: Record<string, unknown>; permission?: string }>>;
  files(params?: { q?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ files: ArchiveFile[] }>>;
  createShare(payload: { itemIds: string[]; permission?: string; expiresAt?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ token: string; url?: string }>>;
  getSecuritySettings(options?: AuthRequestOptions): Promise<ApiEnvelope<{ settings: SecuritySettings }>>;
  testStorageConnection(
    payload: { driver: "local" | "s3"; name: string; config: Record<string, unknown> },
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ connection: StorageConnectionResult }>>;
  testDatabaseConnection(
    payload: { driver: "mysql" | "pgsql" | "sqlite"; host?: string; port?: number; database: string; username?: string; password?: string },
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ connection: DatabaseConnectionResult }>>;
  odbcStatus(options?: AuthRequestOptions): Promise<ApiEnvelope<{ odbc: OdbcProbe }>>;
  odbcTable(table: string, params?: { limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcTablePreview>>;
  odbcCreateRow(table: string, payload: { values: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  odbcUpdateRow(table: string, payload: { keyColumn: string; keyValue: unknown; values: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  odbcDeleteRow(table: string, payload: { keyColumn: string; keyValue: unknown }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  reviewComments(mediaUid: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comments: ReviewComment[] }>>;
  createReviewComment(mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
  updateReviewComment(id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
  reviewLink(token: string): Promise<ApiEnvelope<ReviewLinkDetails>>;
  createReviewLink(payload: { mediaUid: string; permission?: ReviewLinkPermission; expiresAt?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ token: string; url?: string; path?: string; mediaUid: string; permission: ReviewLinkPermission; expiresAt?: string | null }>>;
  collaborationPresence(roomKey: string, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationPresencePayload>>;
  sendCollaborationHeartbeat(roomKey: string, payload?: { status?: CollaborationStatus; resourceId?: string; cursor?: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationPresencePayload>>;
  collaborationLocks(roomKey: string, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload>>;
  acquireCollaborationLock(roomKey: string, payload: { resourceId: string; ttlSeconds?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload & { lock: CollaborationLock }>>;
  releaseCollaborationLock(roomKey: string, payload: { resourceId: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload & { released: boolean }>>;
  collaborationDocument(roomKey: string, resourceId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ roomKey: string; document: CollaborationDocument }>>;
  updateCollaborationDocument(roomKey: string, resourceId: string, payload: { content: string; version: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ roomKey: string; document: CollaborationDocument }>>;
  listUsers(options?: AuthRequestOptions): Promise<ApiEnvelope<{ users: ManagedUser[]; invitations: PendingInvitation[] }>>;
  mentionableUsers(options?: AuthRequestOptions): Promise<ApiEnvelope<{ users: MentionableUser[] }>>;
  createDelegatedAccess(payload: { granteeId: number; itemIds: string[]; expiresAt: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ delegation: DelegatedAccess }>>;
  delegatedAccessList(direction: "granted" | "received", options?: AuthRequestOptions): Promise<ApiEnvelope<{ delegations: DelegatedAccess[] }>>;
  revokeDelegatedAccess(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ delegation: DelegatedAccess }>>;
  inviteUser(payload: { email: string; role: ManagedUserRole }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ invitation: PendingInvitation; token: string }>>;
  updateUserRole(id: string, payload: { role: ManagedUserRole }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ user: ManagedUser }>>;
  deleteUser(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope>;
  onboardingProgress(options?: AuthRequestOptions): Promise<ApiEnvelope<{ progress: OnboardingProgress }>>;
  updateOnboardingStage(stage: OnboardingStageId, payload: { status: OnboardingStage["status"] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ progress: OnboardingProgress }>>;
  acceptInvitation(token: string, payload: { name: string; password: string }): Promise<ApiEnvelope<{ user: ManagedUser }>>;
  intakeTemplates(options?: AuthRequestOptions): Promise<ApiEnvelope<{ templates: IntakeTemplate[] }>>;
  createIntakeTemplate(payload: CreateIntakeTemplatePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ template: IntakeTemplate }>>;
  deleteIntakeTemplate(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  previewImportUrl(url: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ preview: ImportPreview }>>;
  uploadLinks(options?: AuthRequestOptions): Promise<ApiEnvelope<{ links: UploadLink[] }>>;
  createUploadLink(payload: CreateUploadLinkPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ link: UploadLink }>>;
  revokeUploadLink(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ link: UploadLink }>>;
  getUploadLink(token: string): Promise<ApiEnvelope<{ link: UploadLink }>>;
  savedSearches(options?: AuthRequestOptions): Promise<ApiEnvelope<{ searches: SavedSearch[] }>>;
  createSavedSearch(payload: CreateSavedSearchPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ search: SavedSearch }>>;
  deleteSavedSearch(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  updateSavedSearch(id: string, payload: { shared: boolean }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ search: SavedSearch }>>;
  copySavedSearch(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ search: SavedSearch }>>;
  collections(options?: AuthRequestOptions): Promise<ApiEnvelope<{ collections: Collection[] }>>;
  createCollection(payload: CreateCollectionPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ collection: Collection }>>;
  deleteCollection(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  inboxItems(options?: AuthRequestOptions): Promise<ApiEnvelope<{ items: InboxItem[] }>>;
  createInboxItem(payload: CreateInboxItemPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ item: InboxItem }>>;
  updateInboxItem(id: string, payload: UpdateInboxItemPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ item: InboxItem }>>;
  deleteInboxItem(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  vocabularyTerms(options?: AuthRequestOptions): Promise<ApiEnvelope<{ terms: VocabularyTerm[] }>>;
  createVocabularyTerm(payload: CreateVocabularyTermPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ term: VocabularyTerm }>>;
  deleteVocabularyTerm(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  tagNodes(options?: AuthRequestOptions): Promise<ApiEnvelope<{ nodes: TagNode[] }>>;
  createTagNode(payload: CreateTagNodePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ node: TagNode }>>;
  updateTagNode(id: string, payload: UpdateTagNodePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ node: TagNode }>>;
  deleteTagNode(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  reorderTagNodes(order: Array<{ id: string; order_index: number }>, options?: AuthRequestOptions): Promise<ApiEnvelope<{ updated: number }>>;
  mergeTagNodes(id: string, mergeInto: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ merged: boolean; targetNode: TagNode }>>;
  moveTagNode(id: string, parent: string, deleteChildren?: boolean, options?: AuthRequestOptions): Promise<ApiEnvelope<{ moved: boolean; node: TagNode }>>;
  automationRules(params?: { limit?: number; page?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ rules: AutomationRule[]; runs: AutomationRuleRun[]; pagination?: PaginationMeta }>>;
  createAutomationRule(payload: CreateAutomationRulePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ rule: AutomationRule }>>;
  updateAutomationRule(id: string, payload: UpdateAutomationRulePayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ rule: AutomationRule }>>;
  deleteAutomationRule(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ deleted: boolean }>>;
  runAutomationRule(id: string, payload?: { dryRun?: boolean }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ run: AutomationRuleRun }>>;
}

export interface AuthRequestOptions {
  accessToken?: string;
  headers?: Record<string, string>;
}

export function getContractSummary() {
  return {
    title: contract.info.title,
    version: contract.info.version,
    routeCount: Object.keys(contract.paths).length
  };
}

const AUTH_ERROR_MESSAGES_AR: Record<string, string> = {
  "Invalid credentials.": "بيانات الدخول غير صحيحة.",
  "Unauthorized.": "انتهت الجلسة. سجّل الدخول مرة أخرى."
};

const GENERIC_LOGIN_ERROR_AR = "تعذر تسجيل الدخول. تحقق من البيانات وحاول مجدداً.";

function localizeLoginError(error: string): string {
  const known = AUTH_ERROR_MESSAGES_AR[error];

  if (known) {
    return known;
  }

  // Client-produced transport errors are already Arabic; keep them.
  // Anything else (raw English API strings) falls back to a generic Arabic message.
  return /[؀-ۿ]/.test(error) ? error : GENERIC_LOGIN_ERROR_AR;
}

// ponytail: only exact-matches known backend strings ("Unauthorized.", "Invalid
// credentials.") so sentinel checks elsewhere (e.g. response.error === "Forbidden.")
// keep working; a full raw-message translation layer needs backend error codes first.
function translateKnownApiError(error: string): string {
  return AUTH_ERROR_MESSAGES_AR[error] ?? error;
}

function clampApiLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(value as number)));
}

let pendingRefreshAccessToken: Promise<string | null> | null = null;
let cachedAccessToken: string | undefined;

export function createArchiveApiClient({
  baseUrl = "/api/v1",
  fetchImpl = fetch,
  onUnauthorized
}: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onUnauthorized?: () => void;
} = {}): ArchiveApiClient {
  function handleUnauthorized() {
    onUnauthorized?.();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ARCHIVE_UNAUTHORIZED_EVENT));
    }
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (pendingRefreshAccessToken) return pendingRefreshAccessToken;
    pendingRefreshAccessToken = refreshAccessTokenOnce().finally(() => {
      pendingRefreshAccessToken = null;
    });
    return pendingRefreshAccessToken;
  }

  // True when the last refresh failed for a transient reason (network, 429,
  // 5xx) rather than a definitive auth rejection — such failures must not
  // log the user out.
  let lastRefreshFailureTransient = false;

  async function refreshAccessTokenOnce(): Promise<string | null> {
    let response: Response;

    try {
      response = await fetchImpl(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: new Headers({ Accept: "application/json" }),
        credentials: "include"
      });
    } catch {
      lastRefreshFailureTransient = true;
      return null;
    }

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<AuthSession> | null;

    if (!response.ok || !payload?.ok) {
      lastRefreshFailureTransient = response.status === 429 || response.status >= 500;
      return null;
    }

    lastRefreshFailureTransient = false;
    return payload.accessToken;
  }

  async function request<T extends object>(
    path: string,
    {
      method = "GET",
      body,
      accessToken,
      skipRefresh = false,
      extraHeaders
    }: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      body?: unknown;
      accessToken?: string;
      skipRefresh?: boolean;
      extraHeaders?: Record<string, string>;
    } = {}
  ): Promise<ApiEnvelope<T>> {
    const headers = new Headers({ Accept: "application/json" });

    if (body !== undefined && !(body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const effectiveAccessToken = accessToken ?? cachedAccessToken;
    if (effectiveAccessToken) {
      headers.set("Authorization", `Bearer ${effectiveAccessToken}`);
    }

    for (const [key, value] of Object.entries(extraHeaders ?? {})) {
      headers.set(key, value);
    }

    let response: Response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        credentials: "include",
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
      });
    } catch {
      return { ok: false, error: "تعذر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة." };
    }

    const payload = (await response.json().catch(() => ({
      ok: false,
      error: "استجابة غير صالحة من الخادم. حاول لاحقاً أو تواصل مع مسؤول النظام."
    }))) as ApiEnvelope<T>;

    if (
      response.status === 401 &&
      !skipRefresh &&
      path !== "/auth/login" &&
      path !== "/auth/refresh"
    ) {
      const refreshedAccessToken = await refreshAccessToken();

      if (refreshedAccessToken) {
        cachedAccessToken = refreshedAccessToken;
        return request<T>(path, {
          method,
          body,
          accessToken: refreshedAccessToken,
          skipRefresh: true
        });
      }

      if (!lastRefreshFailureTransient) {
        handleUnauthorized();
      }
    }

    if (!response.ok && payload.ok !== false) {
      return { ok: false, code: `http_${response.status}`, error: `فشل الطلب (رمز ${response.status}). أعد المحاولة أو تواصل مع مسؤول النظام.` };
    }

    if (payload.ok === false && payload.code === undefined && !response.ok) {
      return { ...payload, code: `http_${response.status}`, error: translateKnownApiError(payload.error) };
    }

    if (payload.ok === false) {
      return { ...payload, error: translateKnownApiError(payload.error) };
    }

    return payload;
  }

  const get = <T extends object>(path: string, options?: AuthRequestOptions) =>
    request<T>(path, { accessToken: options?.accessToken, extraHeaders: options?.headers });

  const post = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "POST", body, accessToken: options?.accessToken });

  const patch = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "PATCH", body, accessToken: options?.accessToken });

  const put = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "PUT", body, accessToken: options?.accessToken });

  const del = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "DELETE", body, accessToken: options?.accessToken });

  return {
    health: () => get("/health"),
    login: async (payload: LoginRequest): Promise<ApiEnvelope<AuthSession>> => {
      const response = await post<AuthSession>("/auth/login", payload);

      if (!response.ok) {
        return { ...response, error: localizeLoginError(response.error) };
      }

      cachedAccessToken = response.accessToken;

      return response;
    },
    me: (options?: AuthRequestOptions) => get("/auth/me", options),
    refresh: async () => {
      const response = await post<AuthSession>("/auth/refresh");
      if (response.ok) {
        cachedAccessToken = response.accessToken;
      }
      return response;
    },
    logout: async (options?: AuthRequestOptions) => {
      const response = await post("/auth/logout", undefined, options);
      cachedAccessToken = undefined;
      return response;
    },
    search: ({ q = "", store = "", type = "", subtype = "", tag = "", status = "", cursor = "", limit = 20, mode = "keyword" }, options?: AuthRequestOptions) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (store) params.set("store", store);
      if (type) params.set("type", type);
      if (subtype) params.set("subtype", subtype);
      if (tag) params.set("tag", tag);
      if (status) params.set("status", status);
      if (cursor) params.set("cursor", cursor);
      if (mode !== "keyword") params.set("mode", mode);
      params.set("limit", String(clampApiLimit(limit, 20, 100)));
      return get(`/search?${params.toString()}`, options);
    },
    searchSuggestions: ({ q, limit = 8 }, options?: AuthRequestOptions) => get(`/search/suggestions?${new URLSearchParams({ q, limit: String(clampApiLimit(limit, 8, 8)) }).toString()}`, options),
    publicCatalog: ({ q = "", type = "", tag = "", cursor = "", limit = 24 } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (tag) params.set("tag", tag);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", String(clampApiLimit(limit, 24, 100)));
      return get<{ records: PublicCatalogRecord[]; nextCursor?: string | null }>(`/public/catalog?${params.toString()}`);
    },
    plugins: ({ status = "", category = "" } = {}, options?: AuthRequestOptions) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return get<{ runtimePolicy: PluginRuntimePolicy; plugins: PluginCatalogItem[]; permissionScopes: PluginPermissionScopeSummary[] }>(`/plugins${suffix}`, options);
    },
    discover: (params?: { limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      const query = queryParams.toString();
      return get<{ sections: DiscoverSection[] }>(`/discover${query ? `?${query}` : ""}`, options);
    },
    suggestions: (params: { context: SuggestionContext; recordId?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams({ context: params.context });
      if (params.recordId) queryParams.set("recordId", params.recordId);
      return get<{ context: SuggestionContext; suggestions: ArchiveSuggestion[] }>(`/suggestions?${queryParams.toString()}`, options);
    },
    submitSuggestionFeedback: (key: string, payload: { value: SuggestionFeedbackValue; context?: SuggestionContext }, options?: AuthRequestOptions) =>
      put<{ feedback: ArchiveSuggestionFeedback }>(`/suggestions/${encodeURIComponent(key)}/feedback`, payload, options),
    relationGraph: (params?: { recordId?: string; limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.recordId) queryParams.set("recordId", params.recordId);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      const query = queryParams.toString();
      return get<RelationGraphPayload>(`/relations/graph${query ? `?${query}` : ""}`, options);
    },
    createRelation: (payload: CreateRelationPayload, options?: AuthRequestOptions) =>
      post<{ relation: RecordRelation }>("/relations", payload, options),
    updateRelation: (id: string, payload: UpdateRelationPayload, options?: AuthRequestOptions) =>
      patch<{ relation: RecordRelation }>(`/relations/${encodeURIComponent(id)}`, payload, options),
    deleteRelation: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/relations/${encodeURIComponent(id)}`, undefined, options),
    recordNotes: (recordId: string, store = "archive-items", options?: AuthRequestOptions) =>
      get<{ notes: RecordNote[] }>(`/records/${encodeURIComponent(recordId)}/notes?${new URLSearchParams({ store })}`, options),
    createRecordNote: (recordId: string, payload: CreateRecordNotePayload, store = "archive-items", options?: AuthRequestOptions) =>
      post<{ note: RecordNote }>(`/records/${encodeURIComponent(recordId)}/notes?${new URLSearchParams({ store })}`, payload, options),
    updateRecordNote: (id: string, payload: UpdateRecordNotePayload, options?: AuthRequestOptions) =>
      patch<{ note: RecordNote }>(`/record-notes/${encodeURIComponent(id)}`, payload, options),
    deleteRecordNote: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/record-notes/${encodeURIComponent(id)}`, undefined, options),
    recordComments: (recordId: string, store = "archive-items", options?: AuthRequestOptions) =>
      get<{ comments: RecordComment[] }>(`/records/${encodeURIComponent(recordId)}/comments?${new URLSearchParams({ store })}`, options),
    createRecordComment: (recordId: string, payload: CreateRecordCommentPayload, store = "archive-items", options?: AuthRequestOptions) =>
      post<{ comment: RecordComment }>(`/records/${encodeURIComponent(recordId)}/comments?${new URLSearchParams({ store })}`, payload, options),
    deleteRecordComment: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/record-comments/${encodeURIComponent(id)}`, undefined, options),
    activity: (params?: ActivityFilters, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.event) queryParams.set("event", params.event);
      if (params?.resourceType) queryParams.set("resourceType", params.resourceType);
      if (params?.resourceId) queryParams.set("resourceId", params.resourceId);
      if (params?.outcome) queryParams.set("outcome", params.outcome);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      const query = queryParams.toString();
      return get<{ entries: RecordHistoryEntry[]; filters: ActivityFilters; pagination?: PaginationMeta }>(`/activity${query ? `?${query}` : ""}`, options);
    },
    complianceReport: (params?: ComplianceReportFilters, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.set("from", params.from);
      if (params?.to) queryParams.set("to", params.to);
      if (params?.event) queryParams.set("event", params.event);
      if (params?.resourceType) queryParams.set("resourceType", params.resourceType);
      if (params?.outcome) queryParams.set("outcome", params.outcome);
      if (params?.limit) queryParams.set("limit", String(clampApiLimit(params.limit, 100, 500)));
      const query = queryParams.toString();
      return get<{ entries: ComplianceReportEntry[]; filters: ComplianceReportFilters; summary: ComplianceReportSummary }>(`/reports/compliance${query ? `?${query}` : ""}`, options);
    },
    downloadComplianceReport: async (params?: ComplianceReportFilters, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.set("from", params.from);
      if (params?.to) queryParams.set("to", params.to);
      if (params?.event) queryParams.set("event", params.event);
      if (params?.resourceType) queryParams.set("resourceType", params.resourceType);
      if (params?.outcome) queryParams.set("outcome", params.outcome);
      const query = queryParams.toString();
      const headers = new Headers({ Accept: "text/csv" });
      if (options?.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);

      try {
        const response = await fetchImpl(`${baseUrl}/reports/compliance/export${query ? `?${query}` : ""}`, {
          headers,
          credentials: "include"
        });
        if (!response.ok) {
          return { ok: false, error: `تعذر تصدير التقرير (رمز ${response.status}).` };
        }
        const contentDisposition = response.headers.get("content-disposition") || "";
        const filename = contentDisposition.match(/filename=([^;]+)/i)?.[1]?.replace(/^"|"$/g, "") || "archive-compliance-report.csv";
        return { ok: true, blob: await response.blob(), filename };
      } catch {
        return { ok: false, error: "تعذر الاتصال بالخادم لتصدير التقرير." };
      }
    },
    recordHistory: (recordId: string, params?: { limit?: number; page?: number; store?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.store) queryParams.set("store", params.store);
      const query = queryParams.toString();
      return get<{ entries: RecordHistoryEntry[]; pagination?: PaginationMeta }>(`/records/${encodeURIComponent(recordId)}/history${query ? `?${query}` : ""}`, options);
    },
    sync: (params?: { limit?: number; page?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      const query = queryParams.toString();
      return get<{ entries: SyncLogEntry[]; summary: SyncSummary; pagination?: PaginationMeta }>(`/sync${query ? `?${query}` : ""}`, options);
    },
    record: (id: string, options?: AuthRequestOptions) => get<{ record: ArchiveRecord }>(`/records/${encodeURIComponent(id)}`, options),
    createRecord: (payload: CreateRecordPayload, options?: AuthRequestOptions) =>
      post<{ record: ArchiveRecord }>("/records", payload, options),
    recordAttachments: (id: string, store = "archive-items", options?: AuthRequestOptions) => {
      const query = new URLSearchParams({ store });
      return get<{ attachments: RecordAttachment[] }>(`/records/${encodeURIComponent(id)}/attachments?${query}`, options);
    },
    uploadRecordAttachments: (id: string, files: File[], store = "archive-items", options?: AuthRequestOptions) => {
      const form = new FormData();
      form.set("store", store);
      files.forEach((file) => form.append("files[]", file));
      return request<{ attachments: RecordAttachment[] }>(`/records/${encodeURIComponent(id)}/attachments`, {
        method: "POST",
        body: form,
        accessToken: options?.accessToken,
        extraHeaders: options?.headers
      });
    },
    deleteRecordAttachment: (id: string, attachmentId: string, store = "archive-items", options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/records/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}?${new URLSearchParams({ store })}`, undefined, options),
    updateRecordTranscript: (id: string, payload: { transcript: string; store?: string }, options?: AuthRequestOptions) =>
      patch<{ record: ArchiveRecord }>(`/records/${encodeURIComponent(id)}/transcript`, payload, options),
    records: ({ store, cursor, limit = 50 }: { store: string; cursor?: string; limit?: number }, options?: AuthRequestOptions) => {
      const params = new URLSearchParams({ store, limit: String(clampApiLimit(limit, 50, 200)) });
      if (cursor) params.set("cursor", cursor);
      return get<RecordListPayload>(`/records?${params.toString()}`, options);
    },
    types: (params?: { cursor?: string; limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.set("cursor", params.cursor);
      if (params?.limit) queryParams.set("limit", String(clampApiLimit(params.limit, 50, 200)));
      const query = queryParams.toString();
      return get<{ types: ArchiveType[]; nextCursor?: string | null }>(`/types${query ? `?${query}` : ""}`, options);
    },
    type: (id: string, options?: AuthRequestOptions) =>
      get<{ type: ArchiveType }>(`/types/${encodeURIComponent(id)}`, options),
    saveType: (payload: ArchiveType, options?: AuthRequestOptions) =>
      post<{ type: ArchiveType }>("/types", payload, options),
    deleteType: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted?: boolean }>(`/types/${encodeURIComponent(id)}`, undefined, options),
    bulkRecords: (payload: { store: string; records: ArchiveRecord[] }, options?: AuthRequestOptions) =>
      post<{ count: number }>("/records/bulk", payload, options),
    bulkDeleteRecords: (payload: { store: string; ids: string[] }, options?: AuthRequestOptions) =>
      post<{ count: number; results: BulkDeleteResultItem[] }>("/records/bulk-delete", payload, options),
    safetyPreviewScenarios: (options?: AuthRequestOptions) =>
      get<GeneratedSchemas["SafetyPreviewScenariosResponse"]>("/safety-preview/scenarios", options),
    runSafetyPreview: (payload: SafetyPreviewRunPayload, options?: AuthRequestOptions) =>
      post<SafetyPreviewRun>("/safety-preview/run", payload, options),
    trash: (params?: TrashFilters, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.store) queryParams.set("store", params.store);
      if (params?.q) queryParams.set("q", params.q);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      const query = queryParams.toString();
      return get<{ items: TrashEntry[]; pagination?: PaginationMeta }>(`/trash${query ? `?${query}` : ""}`, options);
    },
    restoreTrash: (payload: { store: string; ids: string[] }, options?: AuthRequestOptions) =>
      post<{ count: number; results: TrashRestoreResultItem[] }>("/trash/restore", payload, options),
    purgeTrash: (payload: { store: string; ids: string[] }, options?: AuthRequestOptions) =>
      post<{ count: number; results: TrashPurgeResultItem[] }>("/trash/purge", payload, options),
    rights: (itemId: string, options?: AuthRequestOptions) => get<{ record: RightsRecord }>(`/rights?itemId=${encodeURIComponent(itemId)}`, options),
    upsertRights: (payload: Omit<RightsRecord, "id" | "createdAt" | "updatedAt">, options?: AuthRequestOptions) =>
      post<{ record: RightsRecord }>("/rights", payload, options),
    expiringRights: (params?: { days?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.days) queryParams.set("days", String(params.days));
      const query = queryParams.toString();
      return get<{ records: RightsRecord[] }>(`/rights/expiring${query ? `?${query}` : ""}`, options);
    },
    rightsEnforcement: (itemId: string, options?: AuthRequestOptions) =>
      get<RightsEnforcementStatus>(`/rights/${encodeURIComponent(itemId)}/enforcement`, options),
    listBackups: (options?: AuthRequestOptions) => get<{ backups: BackupInfo[] }>("/system/backups", options),
    runBackup: (options?: AuthRequestOptions) => post<{ backup: BackupRunResult }>("/system/backups/run", undefined, options),
    previewBackup: (payload: { name: string }, options?: AuthRequestOptions) =>
      post<{ preview: BackupPreview }>("/system/backups/preview", payload, options),
    restoreBackup: (payload: { name: string }, options?: AuthRequestOptions) =>
      post<{ result: BackupRestoreResult }>("/system/backups/restore", payload, options),
    verifyBackup: (payload: { name: string }, options?: AuthRequestOptions) =>
      post<{ verification: BackupVerification }>("/system/backups/verify", payload, options),
    runDrDrill: (options?: AuthRequestOptions) =>
      post<{ result: DrDrillResult }>("/system/backups/dr-drill", undefined, options),
    getDrDrillStatus: (options?: AuthRequestOptions) =>
      get<{ status: DrDrillStatus }>("/system/backups/dr-status", options),
    systemStatus: (options?: AuthRequestOptions) => get<{ metrics: SystemMetrics; dr: DrProbe }>("/system/status", options),
    systemMetricsHistory: (params?: { days?: number }, options?: AuthRequestOptions) => {
      const query = params?.days ? `?days=${encodeURIComponent(String(params.days))}` : "";
      return get<{ samples: StorageSample[] }>(`/system/metrics/history${query}`, options);
    },
    drProbe: (options?: AuthRequestOptions) => get<{ dr: DrProbe }>("/system/dr-probe", options),
    runSystemControlAction: (action: SystemControlAction, options?: AuthRequestOptions) =>
      post<{ result: SystemControlResult }>(`/system/control/${encodeURIComponent(action)}`, undefined, options),
    exportAccountData: (options?: AuthRequestOptions) => get<{ export: AccountExport }>("/account/export", options),
    browseFiles: (params?: { path?: string; query?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.path) queryParams.set("path", params.path);
      if (params?.query) queryParams.set("query", params.query);
      const query = queryParams.toString();
      return get<{ path: string; entries: FileBrowserEntry[] }>(`/files/browser${query ? `?${query}` : ""}`, options);
    },
    ingestFtpPull: (payload: FtpPullPayload, options?: AuthRequestOptions) =>
      post<{ ingested: unknown[]; skipped: number }>("/ingest/ftp/pull", payload, options),
    ingestSmbPull: (payload: SmbPullPayload, options?: AuthRequestOptions) =>
      post<{ ingested: unknown[]; skipped: number }>("/ingest/smb/pull", payload, options),
    mediaJob: (id: string, options?: AuthRequestOptions) => get<{ job: MediaJob }>(`/media/jobs/${encodeURIComponent(id)}`, options),
    mediaJobs: (params?: { status?: MediaJobStatus; recordId?: string; limit?: number; page?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set("status", params.status);
      if (params?.recordId) queryParams.set("recordId", params.recordId);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      const query = queryParams.toString();
      return get<{ jobs: MediaJob[]; pagination?: PaginationMeta }>(`/media/jobs${query ? `?${query}` : ""}`, options);
    },
    createMediaJob: (payload: CreateMediaJobPayload, options?: AuthRequestOptions) =>
      post<{ job: MediaJob }>("/media/jobs", payload, options),
    cancelMediaJob: (id: string, options?: AuthRequestOptions) =>
      post<{ job: MediaJob }>(`/media/jobs/${encodeURIComponent(id)}/cancel`, {}, options),
    broadcastMetadata: (recordId: string, options?: AuthRequestOptions) =>
      get<{ configured: boolean; integrations: { mos: boolean; mxf: boolean }; metadata: BroadcastMetadata | null }>(
        `/records/${encodeURIComponent(recordId)}/broadcast-metadata`,
        options,
      ),
    updateBroadcastMetadata: (recordId: string, payload: BroadcastMetadataPayload, options?: AuthRequestOptions) =>
      put<{ configured: boolean; integrations: { mos: boolean; mxf: boolean }; metadata: BroadcastMetadata | null }>(
        `/records/${encodeURIComponent(recordId)}/broadcast-metadata`,
        payload,
        options,
      ),
    ingestScan: (payload?: { subdir?: string }, options?: AuthRequestOptions) =>
      post<{ ingested: unknown[]; skipped: number }>("/ingest/scan", payload, options),
    uploadFile: async (file: File, params?: { folder?: string }, options?: AuthRequestOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      if (params?.folder) formData.set("folder", params.folder);

      const headers = new Headers({ Accept: "application/json" });
      const effectiveAccessToken = options?.accessToken ?? cachedAccessToken;
      if (effectiveAccessToken) {
        headers.set("Authorization", `Bearer ${effectiveAccessToken}`);
      }

      let response: Response;

      try {
        response = await fetchImpl(`${baseUrl}/uploads`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData
        });
      } catch {
        return { ok: false, error: "تعذر الاتصال بالخادم أثناء الرفع. تحقق من الاتصال ثم أعد المحاولة." } as ApiEnvelope<{ record: UploadedRecord }>;
      }

      const payload = (await response.json().catch(() => ({
        ok: false,
        error: "استجابة غير صالحة من الخادم أثناء الرفع."
      }))) as ApiEnvelope<{ record: UploadedRecord }>;

      if (!response.ok && payload.ok !== false) {
        return { ok: false, error: `فشل الرفع (رمز ${response.status}). أعد المحاولة.` } as ApiEnvelope<{ record: UploadedRecord }>;
      }

      return payload;
    },
    createUploadSession: (payload, options) =>
      post<{ session: UploadSession }>("/uploads/sessions", payload, options),
    uploadSessionChunk: async (sessionId, index, chunk, options) => {
      const headers = new Headers({ Accept: "application/json", "Content-Type": "application/octet-stream" });
      const effectiveAccessToken = options?.accessToken ?? cachedAccessToken;
      if (effectiveAccessToken) {
        headers.set("Authorization", `Bearer ${effectiveAccessToken}`);
      }

      let response: Response;

      try {
        response = await fetchImpl(`${baseUrl}/uploads/sessions/${encodeURIComponent(sessionId)}/chunks/${index}`, {
          method: "PUT",
          headers,
          credentials: "include",
          body: chunk
        });
      } catch {
        return { ok: false, error: "تعذر الاتصال بالخادم أثناء رفع الجزء. تحقق من الاتصال ثم أعد المحاولة." } as ApiEnvelope<{ receivedChunks: number[]; totalChunks: number }>;
      }

      const responsePayload = (await response.json().catch(() => ({
        ok: false,
        error: "استجابة غير صالحة من الخادم أثناء رفع الجزء."
      }))) as ApiEnvelope<{ receivedChunks: number[]; totalChunks: number }>;

      if (!response.ok && responsePayload.ok !== false) {
        return { ok: false, error: `فشل رفع الجزء (رمز ${response.status}). أعد المحاولة.` } as ApiEnvelope<{ receivedChunks: number[]; totalChunks: number }>;
      }

      return responsePayload;
    },
    uploadSessionStatus: (sessionId, options) =>
      get<{ session: UploadSession }>(`/uploads/sessions/${encodeURIComponent(sessionId)}`, options),
    completeUploadSession: (sessionId, options) =>
      post<{ record: UploadedRecord }>(`/uploads/sessions/${encodeURIComponent(sessionId)}/complete`, undefined, options),
    abortUploadSession: (sessionId, options) => del(`/uploads/sessions/${encodeURIComponent(sessionId)}`, undefined, options),
    scheduledUploads: (params?: { cursor?: string; limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.set("cursor", params.cursor);
      if (params?.limit) queryParams.set("limit", String(clampApiLimit(params.limit, 50, 200)));
      const query = queryParams.toString();
      return get<{ schedules: ScheduledUpload[]; nextCursor?: string | null }>(`/uploads/schedules${query ? `?${query}` : ""}`, options);
    },
    scheduledUpload: (id: string, options?: AuthRequestOptions) =>
      get<{ schedule: ScheduledUpload }>(`/uploads/schedules/${encodeURIComponent(id)}`, options),
    createScheduledUpload: (payload: CreateScheduledUploadPayload, options?: AuthRequestOptions) =>
      post<{ schedule: ScheduledUploadStaged }>("/uploads/schedules", payload, options),
    rescheduleScheduledUpload: (id: string, payload: RescheduleUploadRequest, options?: AuthRequestOptions) =>
      patch<{ schedule: ScheduledUpload }>(`/uploads/schedules/${encodeURIComponent(id)}`, payload, options),
    cancelScheduledUpload: (id: string, options?: AuthRequestOptions) =>
      del<{ schedule: ScheduledUpload }>(`/uploads/schedules/${encodeURIComponent(id)}`, undefined, options),
    retryScheduledUpload: (id: string, options?: AuthRequestOptions) =>
      post<{ schedule: ScheduledUpload }>(`/uploads/schedules/${encodeURIComponent(id)}/retry`, undefined, options),
    share: (token: string, password?: string) =>
      get(`/share/${encodeURIComponent(token)}`, password ? { headers: { "X-Share-Password": password } } : undefined),
    files: (params?: { q?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.q) queryParams.set("q", params.q);
      const query = queryParams.toString();
      return get<{ files: ArchiveFile[] }>(`/files${query ? `?${query}` : ""}`, options);
    },
    createShare: (payload: { itemIds: string[]; permission?: string; expiresAt?: string }, options?: AuthRequestOptions) =>
      post<{ token: string; url?: string }>("/share", { scope: { itemIds: payload.itemIds }, permission: payload.permission, expiresAt: payload.expiresAt }, options),
    getSecuritySettings: (options?: AuthRequestOptions) =>
      get<{ settings: SecuritySettings }>("/system/security-settings", options),
    testStorageConnection: (payload: { driver: "local" | "s3"; name: string; config: Record<string, unknown> }, options?: AuthRequestOptions) =>
      post<{ connection: StorageConnectionResult }>("/system/test-storage", payload, options),
    testDatabaseConnection: (payload: { driver: "mysql" | "pgsql" | "sqlite"; host?: string; port?: number; database: string; username?: string; password?: string }, options?: AuthRequestOptions) =>
      post<{ connection: DatabaseConnectionResult }>("/system/test-database", payload, options),
    odbcStatus: (options?: AuthRequestOptions) =>
      get<{ odbc: OdbcProbe }>("/system/odbc", options),
    odbcTable: (table: string, params?: { limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      const query = queryParams.toString();
      return get<OdbcTablePreview>(`/system/odbc/tables/${encodeURIComponent(table)}${query ? `?${query}` : ""}`, options);
    },
    odbcCreateRow: (table: string, payload: { values: Record<string, unknown> }, options?: AuthRequestOptions) =>
      post<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    odbcUpdateRow: (table: string, payload: { keyColumn: string; keyValue: unknown; values: Record<string, unknown> }, options?: AuthRequestOptions) =>
      patch<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    odbcDeleteRow: (table: string, payload: { keyColumn: string; keyValue: unknown }, options?: AuthRequestOptions) =>
      del<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    reviewComments: (mediaUid: string, options?: AuthRequestOptions) =>
      get<{ comments: ReviewComment[] }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, options),
    createReviewComment: (mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions) =>
      post<{ comment: ReviewComment }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, payload, options),
    updateReviewComment: (id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions) =>
      patch<{ comment: ReviewComment }>(`/review-comments/${encodeURIComponent(id)}`, payload, options),
    reviewLink: (token: string) =>
      get<ReviewLinkDetails>(`/review-links/${encodeURIComponent(token)}`),
    createReviewLink: (payload: { mediaUid: string; permission?: ReviewLinkPermission; expiresAt?: string }, options?: AuthRequestOptions) =>
      post<{ token: string; url?: string; path?: string; mediaUid: string; permission: ReviewLinkPermission; expiresAt?: string | null }>(
        `/media/${encodeURIComponent(payload.mediaUid)}/review-links`,
        { permission: payload.permission, expiresAt: payload.expiresAt },
        options
      ),
    listUsers: (options?: AuthRequestOptions) =>
      get<{ users: ManagedUser[]; invitations: PendingInvitation[] }>("/users", options),
    mentionableUsers: (options?: AuthRequestOptions) =>
      get<{ users: MentionableUser[] }>("/users/mentionable", options),
    createDelegatedAccess: (payload: { granteeId: number; itemIds: string[]; expiresAt: string }, options?: AuthRequestOptions) =>
      post<{ delegation: DelegatedAccess }>("/delegated-access", { granteeId: payload.granteeId, scope: { itemIds: payload.itemIds }, expiresAt: payload.expiresAt }, options),
    delegatedAccessList: (direction: "granted" | "received", options?: AuthRequestOptions) =>
      get<{ delegations: DelegatedAccess[] }>(`/delegated-access?direction=${direction}`, options),
    revokeDelegatedAccess: (id: string, options?: AuthRequestOptions) =>
      del<{ delegation: DelegatedAccess }>(`/delegated-access/${encodeURIComponent(id)}`, undefined, options),
    inviteUser: (payload: { email: string; role: ManagedUserRole }, options?: AuthRequestOptions) =>
      post<{ invitation: PendingInvitation; token: string }>("/users", payload, options),
    updateUserRole: (id: string, payload: { role: ManagedUserRole }, options?: AuthRequestOptions) =>
      patch<{ user: ManagedUser }>(`/users/${encodeURIComponent(id)}`, payload, options),
    deleteUser: (id: string, options?: AuthRequestOptions) => del(`/users/${encodeURIComponent(id)}`, undefined, options),
    onboardingProgress: (options?: AuthRequestOptions) => get<{ progress: OnboardingProgress }>("/onboarding/progress", options),
    updateOnboardingStage: (stage: OnboardingStageId, payload: { status: OnboardingStage["status"] }, options?: AuthRequestOptions) =>
      patch<{ progress: OnboardingProgress }>(`/onboarding/progress/${encodeURIComponent(stage)}`, payload, options),
    acceptInvitation: (token: string, payload: { name: string; password: string }) =>
      post<{ user: ManagedUser }>(`/invitations/${encodeURIComponent(token)}/accept`, payload),
    collaborationPresence: (roomKey: string, options?: AuthRequestOptions) =>
      get<CollaborationPresencePayload>(`/collaboration/rooms/${encodeURIComponent(roomKey)}/presence`, options),
    sendCollaborationHeartbeat: (
      roomKey: string,
      payload?: { status?: CollaborationStatus; resourceId?: string; cursor?: Record<string, unknown> },
      options?: AuthRequestOptions
    ) =>
      post<CollaborationPresencePayload>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/presence`,
        payload,
        options
      ),
    collaborationLocks: (roomKey: string, options?: AuthRequestOptions) =>
      get<CollaborationLocksPayload>(`/collaboration/rooms/${encodeURIComponent(roomKey)}/locks`, options),
    acquireCollaborationLock: (roomKey: string, payload: { resourceId: string; ttlSeconds?: number }, options?: AuthRequestOptions) =>
      post<CollaborationLocksPayload & { lock: CollaborationLock }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/locks`,
        payload,
        options
      ),
    releaseCollaborationLock: (roomKey: string, payload: { resourceId: string }, options?: AuthRequestOptions) =>
      post<CollaborationLocksPayload & { released: boolean }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/locks/release`,
        payload,
        options
      ),
    collaborationDocument: (roomKey: string, resourceId: string, options?: AuthRequestOptions) =>
      get<{ roomKey: string; document: CollaborationDocument }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/documents/${encodeURIComponent(resourceId)}`,
        options
      ),
    updateCollaborationDocument: (
      roomKey: string,
      resourceId: string,
      payload: { content: string; version: number },
      options?: AuthRequestOptions
    ) =>
      post<{ roomKey: string; document: CollaborationDocument }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/documents/${encodeURIComponent(resourceId)}`,
        payload,
        options
      ),
    intakeTemplates: (options?: AuthRequestOptions) =>
      get<{ templates: IntakeTemplate[] }>("/intake-templates", options),
    createIntakeTemplate: (payload: CreateIntakeTemplatePayload, options?: AuthRequestOptions) =>
      post<{ template: IntakeTemplate }>("/intake-templates", payload, options),
    deleteIntakeTemplate: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/intake-templates/${encodeURIComponent(id)}`, undefined, options),
    previewImportUrl: (url: string, options?: AuthRequestOptions) =>
      post<{ preview: ImportPreview }>("/import/preview", { url }, options),
    uploadLinks: (options?: AuthRequestOptions) => get<{ links: UploadLink[] }>("/upload-links", options),
    createUploadLink: (payload: CreateUploadLinkPayload, options?: AuthRequestOptions) =>
      post<{ link: UploadLink }>("/upload-links", payload, options),
    revokeUploadLink: (id: string, options?: AuthRequestOptions) =>
      post<{ link: UploadLink }>(`/upload-links/${encodeURIComponent(id)}/revoke`, undefined, options),
    getUploadLink: (token: string) => get<{ link: UploadLink }>(`/upload-links/${encodeURIComponent(token)}`),
    savedSearches: (options?: AuthRequestOptions) => get<{ searches: SavedSearch[] }>("/saved-searches", options),
    createSavedSearch: (payload: CreateSavedSearchPayload, options?: AuthRequestOptions) =>
      post<{ search: SavedSearch }>("/saved-searches", payload, options),
    deleteSavedSearch: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/saved-searches/${encodeURIComponent(id)}`, undefined, options),
    updateSavedSearch: (id: string, payload: { shared: boolean }, options?: AuthRequestOptions) =>
      patch<{ search: SavedSearch }>(`/saved-searches/${encodeURIComponent(id)}`, payload, options),
    copySavedSearch: (id: string, options?: AuthRequestOptions) =>
      post<{ search: SavedSearch }>(`/saved-searches/${encodeURIComponent(id)}/copy`, undefined, options),
    collections: (options?: AuthRequestOptions) => get<{ collections: Collection[] }>("/collections", options),
    createCollection: (payload: CreateCollectionPayload, options?: AuthRequestOptions) =>
      post<{ collection: Collection }>("/collections", payload, options),
    deleteCollection: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/collections/${encodeURIComponent(id)}`, undefined, options),
    inboxItems: (options?: AuthRequestOptions) => get<{ items: InboxItem[] }>("/inbox", options),
    createInboxItem: (payload: CreateInboxItemPayload, options?: AuthRequestOptions) =>
      post<{ item: InboxItem }>("/inbox", payload, options),
    updateInboxItem: (id: string, payload: UpdateInboxItemPayload, options?: AuthRequestOptions) =>
      patch<{ item: InboxItem }>(`/inbox/${encodeURIComponent(id)}`, payload, options),
    deleteInboxItem: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/inbox/${encodeURIComponent(id)}`, undefined, options),
    vocabularyTerms: (options?: AuthRequestOptions) => get<{ terms: VocabularyTerm[] }>("/vocabulary", options),
    createVocabularyTerm: (payload: CreateVocabularyTermPayload, options?: AuthRequestOptions) =>
      post<{ term: VocabularyTerm }>("/vocabulary", payload, options),
    deleteVocabularyTerm: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/vocabulary/${encodeURIComponent(id)}`, undefined, options),
    tagNodes: (options?: AuthRequestOptions) => get<{ nodes: TagNode[] }>("/tag-nodes", options),
    createTagNode: (payload: CreateTagNodePayload, options?: AuthRequestOptions) =>
      post<{ node: TagNode }>("/tag-nodes", payload, options),
    updateTagNode: (id: string, payload: UpdateTagNodePayload, options?: AuthRequestOptions) =>
      patch<{ node: TagNode }>(`/tag-nodes/${encodeURIComponent(id)}`, payload, options),
    deleteTagNode: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/tag-nodes/${encodeURIComponent(id)}`, undefined, options),
    reorderTagNodes: (order: Array<{ id: string; order_index: number }>, options?: AuthRequestOptions) =>
      post<{ updated: number }>("/tag-nodes/reorder", { order }, options),
    mergeTagNodes: (id: string, mergeInto: string, options?: AuthRequestOptions) =>
      post<{ merged: boolean; targetNode: TagNode }>(`/tag-nodes/${encodeURIComponent(id)}/merge`, { mergeInto }, options),
    moveTagNode: (id: string, parent: string, deleteChildren?: boolean, options?: AuthRequestOptions) =>
      post<{ moved: boolean; node: TagNode }>(`/tag-nodes/${encodeURIComponent(id)}/move`, { parent, deleteChildren }, options),
    automationRules: (params?: { limit?: number; page?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.page) queryParams.set("page", String(params.page));
      const query = queryParams.toString();
      return get<{ rules: AutomationRule[]; runs: AutomationRuleRun[]; pagination?: PaginationMeta }>(`/automation/rules${query ? `?${query}` : ""}`, options);
    },
    createAutomationRule: (payload: CreateAutomationRulePayload, options?: AuthRequestOptions) =>
      post<{ rule: AutomationRule }>("/automation/rules", payload, options),
    updateAutomationRule: (id: string, payload: UpdateAutomationRulePayload, options?: AuthRequestOptions) =>
      patch<{ rule: AutomationRule }>(`/automation/rules/${encodeURIComponent(id)}`, payload, options),
    deleteAutomationRule: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/automation/rules/${encodeURIComponent(id)}`, undefined, options),
    runAutomationRule: (id: string, payload?: { dryRun?: boolean }, options?: AuthRequestOptions) =>
      post<{ run: AutomationRuleRun }>(`/automation/rules/${encodeURIComponent(id)}/run`, payload, options)
  };
}

export interface PortableState {
  contentTypes?: any[];
  videoItems?: any[];
  settings?: Record<string, any>;
  changeHistory?: any[];
  bookmarks?: any[];
  relations?: any[];
  virtualCollections?: any[];
  vocabulary?: any[];
  hierarchicalTags?: any[];
  users?: any[];
  auditLogs?: any[];
}

export interface PortableArchivePayload extends PortableState {
  exportedAt: string;
  version: string;
  settings: Record<string, any>;
}

export interface PortablePayloadOptions {
  exportedAt?: string;
  version?: string;
}

export function redactPortableUsers(users: any[] = []): any[] {
  return (users || []).map((user) => ({
    ...user,
    passwordHash: "__REDACTED__",
    isActive: false,
    mustResetPassword: true
  }));
}

export function createPortableArchivePayload(state: PortableState = {}, options: PortablePayloadOptions = {}): PortableArchivePayload {
  const exportedAt = options.exportedAt || new Date().toISOString();
  const version = options.version || "2.0";

  return {
    contentTypes: state.contentTypes || [],
    videoItems: state.videoItems || [],
    settings: { ...(state.settings || {}), masterPasswordHash: void 0 },
    changeHistory: state.changeHistory || [],
    bookmarks: state.bookmarks || [],
    relations: state.relations || [],
    virtualCollections: state.virtualCollections || [],
    vocabulary: state.vocabulary || [],
    hierarchicalTags: state.hierarchicalTags || [],
    users: redactPortableUsers(state.users || []),
    auditLogs: state.auditLogs || [],
    exportedAt,
    version
  };
}

export function getPortablePayloadCounts(payload: Partial<PortableArchivePayload> = {}): Record<string, number> {
  return {
    contentTypes: payload.contentTypes?.length || 0,
    videoItems: payload.videoItems?.length || 0,
    bookmarks: payload.bookmarks?.length || 0,
    relations: payload.relations?.length || 0,
    virtualCollections: payload.virtualCollections?.length || 0,
    vocabulary: payload.vocabulary?.length || 0,
    hierarchicalTags: payload.hierarchicalTags?.length || 0,
    users: payload.users?.length || 0,
    auditLogs: payload.auditLogs?.length || 0
  };
}

export function createPortablePayloadSummary(payload: Partial<PortableArchivePayload> = {}): {
  counts: Record<string, number>;
  totalRecords: number;
  exportedAt: string | null;
  version: string | null;
} {
  const counts = getPortablePayloadCounts(payload);
  return {
    counts,
    totalRecords: Object.values(counts).reduce((total, count) => total + Number(count || 0), 0),
    exportedAt: payload.exportedAt || null,
    version: payload.version || null
  };
}

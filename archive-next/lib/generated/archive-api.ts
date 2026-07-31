// Generated from docs/api/archive-contract.openapi.json by pnpm api:generate. Do not edit.
export interface paths {
    "/account/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export the authenticated user's own account data */
        get: operations["exportAccountData"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List filterable audit-backed activity entries */
        get: operations["listActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List API keys (admin only, tokens never included) */
        get: operations["listApiKeys"];
        put?: never;
        /** Create an API key (admin only; role capped at editor) */
        post: operations["createApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api-keys/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an API key (admin only) */
        delete: operations["deleteApiKey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/attachments/{attachmentId}/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List checksum verification history for an attachment */
        get: operations["listFileHealthChecks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/attachments/{attachmentId}/health/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run a fresh checksum verification for an attachment */
        post: operations["runFileHealthCheck"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Authenticate a user */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke the current session */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return the current authenticated user */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate the HttpOnly refresh cookie and issue a new access token */
        post: operations["refreshSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/automation/rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List automation rules and recent execution runs */
        get: operations["listAutomationRules"];
        put?: never;
        /** Create an automation rule */
        post: operations["createAutomationRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/automation/rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete an automation rule */
        delete: operations["deleteAutomationRule"];
        options?: never;
        head?: never;
        /** Update an automation rule */
        patch: operations["updateAutomationRule"];
        trace?: never;
    };
    "/automation/rules/{id}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run or dry-run an automation rule */
        post: operations["runAutomationRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bulk-macros": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the current editor's bulk macros */
        get: operations["listBulkMacros"];
        put?: never;
        /** Create a reusable ordered bulk macro */
        post: operations["createBulkMacro"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bulk-macros/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read an owned bulk macro */
        get: operations["getBulkMacro"];
        put?: never;
        post?: never;
        /** Delete an owned bulk macro */
        delete: operations["deleteBulkMacro"];
        options?: never;
        head?: never;
        /** Update an owned bulk macro and increment its version */
        patch: operations["updateBulkMacro"];
        trace?: never;
    };
    "/bulk-macros/{id}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview a macro without changing records */
        post: operations["previewBulkMacro"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bulk-macros/{id}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Execute a macro with its signed preview confirmation */
        post: operations["runBulkMacro"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bulk-macros/{id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List persisted runs for an owned bulk macro */
        get: operations["listBulkMacroRuns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bulk-macros/{id}/runs/{runId}/retry-failed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry only the failed/partial targets of a prior run, re-checking permissions and current state */
        post: operations["retryBulkMacroFailedTargets"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collaboration/rooms/{roomKey}/documents/{resourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the shared document draft for a room resource */
        get: operations["getCollaborationDocument"];
        put?: never;
        /** Update the shared document draft with optimistic versioning */
        post: operations["updateCollaborationDocument"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collaboration/rooms/{roomKey}/locks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active resource locks in a collaboration room */
        get: operations["listCollaborationLocks"];
        put?: never;
        /** Acquire or refresh a resource lock */
        post: operations["acquireCollaborationLock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collaboration/rooms/{roomKey}/locks/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Release a resource lock held by the current user */
        post: operations["releaseCollaborationLock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collaboration/rooms/{roomKey}/presence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active participants in a collaboration room */
        get: operations["listCollaborationPresence"];
        put?: never;
        /** Send a collaboration presence heartbeat */
        post: operations["sendCollaborationHeartbeat"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List collections for the current user */
        get: operations["listCollections"];
        put?: never;
        /** Create a collection for the current user */
        post: operations["createCollection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collections/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a collection */
        delete: operations["deleteCollection"];
        options?: never;
        head?: never;
        /** Rename or update the criteria of an existing saved collection */
        patch: operations["updateCollection"];
        trace?: never;
    };
    "/collections/{id}/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List explicit member record ids of a collection */
        get: operations["listCollectionRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/collections/{id}/records/{recordId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a record to a collection's explicit membership */
        post: operations["addCollectionRecord"];
        /** Remove a record from a collection's explicit membership */
        delete: operations["removeCollectionRecord"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/department-field-owners": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List field owners for a department */
        get: operations["listDepartmentFieldOwners"];
        /** Replace field owners for a department */
        put: operations["replaceDepartmentFieldOwners"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/department-quality-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List department quality rules */
        get: operations["listDepartmentQualityRules"];
        /** Create or update a department quality rule */
        put: operations["upsertDepartmentQualityRule"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/department-quality-rules/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview department quality readiness */
        post: operations["previewDepartmentQuality"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/department-template-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return aggregate department template metrics */
        get: operations["getDepartmentTemplateMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/discover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return discovery rails for archive exploration */
        get: operations["discoverRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/favorites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the current user's saved archive favorites */
        get: operations["listFavorites"];
        put?: never;
        /** Save an archive record as a favorite for the current user */
        post: operations["createFavorite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/favorites/{recordId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove the current user's saved favorite */
        delete: operations["deleteFavorite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/field-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List open field requests across records, for work-list surfaces */
        get: operations["listOpenFieldRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/field-requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Cancel a field request */
        delete: operations["deleteFieldRequest"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/field-requests/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve a field request */
        post: operations["resolveFieldRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List files in the active file store */
        get: operations["listFiles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download or stream a file through the API */
        get: operations["getFile"];
        /** Upload or replace a file by key */
        put: operations["putFile"];
        post?: never;
        /** Delete a file by key */
        delete: operations["deleteFile"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/browser": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Browse a virtual file-store path */
        get: operations["browseFiles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/unused": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List files with no record_attachments reference, for safe manual review */
        get: operations["listUnusedFiles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/folders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List logical archive folders */
        get: operations["listFolders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Server and backend health */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/import/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Fetch and validate metadata preview for an import-from-url intake */
        post: operations["previewImportUrl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List inbox items for the current user */
        get: operations["listInboxItems"];
        put?: never;
        /** Create an inbox item for the current user */
        post: operations["createInboxItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/inbox/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete an inbox item */
        delete: operations["deleteInboxItem"];
        options?: never;
        head?: never;
        /** Update an inbox item */
        patch: operations["updateInboxItem"];
        trace?: never;
    };
    "/inbox/{id}/department-routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Route an inbox item to a department */
        post: operations["routeInboxDepartment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/inbox/{id}/department-routing/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview routing an inbox item to a department */
        post: operations["previewInboxDepartmentRouting"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/dropbox/pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pull files from the connected Dropbox folder and create archive records */
        post: operations["dropboxPullIngest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/ftp/pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pull files from FTP source and create archive records */
        post: operations["ftpPullIngest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/scan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Scan ingest directory and create archive records */
        post: operations["scanIngest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/smb/pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pull files from SMB source and create archive records */
        post: operations["smbPullIngest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/watched/batches/{batchId}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Apply an approved watched ingest batch */
        post: operations["applyWatchedIngestBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/watched/rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List watched ingest routing rules */
        get: operations["listWatchedIngestRules"];
        put?: never;
        /** Create watched ingest routing rule */
        post: operations["createWatchedIngestRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ingest/watched/rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete watched ingest routing rule */
        delete: operations["deleteWatchedIngestRule"];
        options?: never;
        head?: never;
        /** Update watched ingest routing rule */
        patch: operations["updateWatchedIngestRule"];
        trace?: never;
    };
    "/ingest/watched/scan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview stable files from the watched ingest folder */
        post: operations["previewWatchedIngest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/intake-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List reusable archive-entry intake templates */
        get: operations["listIntakeTemplates"];
        put?: never;
        /** Create a reusable archive-entry intake template */
        post: operations["createIntakeTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/intake-templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete an intake template */
        delete: operations["deleteIntakeTemplate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/dropbox/webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Verify Dropbox webhook endpoint */
        get: operations["verifyDropboxWebhook"];
        put?: never;
        /** Receive signed Dropbox change notification */
        post: operations["receiveDropboxWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invitations/{token}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept an invitation token and create the invited user account */
        post: operations["acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/link-audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List record relations pointing at a record that no longer exists */
        get: operations["listBrokenLinks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/media/{mediaUid}/review-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a public visual review link for media */
        post: operations["createReviewLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/media/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List media processing workflows */
        get: operations["listMediaWorkflows"];
        put?: never;
        /** Queue a media processing workflow */
        post: operations["queueMediaWorkflow"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/media/jobs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read media workflow status */
        get: operations["getMediaWorkflow"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metadata-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List enabled metadata templates, optionally filtered by type or department */
        get: operations["listMetadataTemplates"];
        put?: never;
        /** Create a metadata template */
        post: operations["createMetadataTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metadata-templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a metadata template */
        delete: operations["deleteMetadataTemplate"];
        options?: never;
        head?: never;
        /** Update a metadata template */
        patch: operations["updateMetadataTemplate"];
        trace?: never;
    };
    "/metadata-templates/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish the current department template draft */
        post: operations["publishMetadataTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metadata-templates/{id}/published-version/{version}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore a previously published template version */
        post: operations["restorePublishedMetadataTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metadata-templates/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List immutable snapshots of a metadata template */
        get: operations["listMetadataTemplateVersions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/montage-projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List montage projects filtered by status */
        get: operations["listMontageProjects"];
        put?: never;
        /** Create a montage project */
        post: operations["createMontageProject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/montage-projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a montage project */
        get: operations["getMontageProject"];
        /** Update a montage project */
        put: operations["updateMontageProject"];
        post?: never;
        /** Delete a montage project */
        delete: operations["deleteMontageProject"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/naming-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List filename prefix rules per project or type */
        get: operations["listNamingRules"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/naming-rules/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Create or replace the naming rule for a project/type key */
        put: operations["upsertNamingRule"];
        post?: never;
        /** Remove the naming rule for a project/type key */
        delete: operations["deleteNamingRule"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/onboarding/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the shared organisation onboarding progress */
        get: operations["getOnboardingProgress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/onboarding/progress/{stage}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update one shared onboarding stage (admin only) */
        patch: operations["updateOnboardingStage"];
        trace?: never;
    };
    "/plugins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return the local catalog-only plugin marketplace with permission review metadata */
        get: operations["listPlugins"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/project-tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List project tasks */
        get: operations["listProjectTasks"];
        put?: never;
        /** Create a project task */
        post: operations["createProjectTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/project-tasks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update project task */
        patch: operations["updateProjectTask"];
        trace?: never;
    };
    "/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List projects */
        get: operations["listProjects"];
        put?: never;
        /** Create a project */
        post: operations["createProject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a project and its record links */
        delete: operations["deleteProject"];
        options?: never;
        head?: never;
        /** Update project name, notes, or order */
        patch: operations["updateProject"];
        trace?: never;
    };
    "/projects/{id}/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List record ids linked to a project */
        get: operations["listProjectRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}/records/{recordId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Link a record to a project, without moving it out of its type/folder */
        post: operations["linkProjectRecord"];
        /** Unlink a record from a project */
        delete: operations["unlinkProjectRecord"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}/records/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Persist the explicit order of every linked project record */
        put: operations["reorderProjectRecords"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the public catalog of published records */
        get: operations["getPublicCatalog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/record-comments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Soft-delete a team record comment */
        delete: operations["deleteRecordComment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/record-notes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a private archive record note */
        delete: operations["deleteRecordNote"];
        options?: never;
        head?: never;
        /** Update a private archive record note */
        patch: operations["updateRecordNote"];
        trace?: never;
    };
    "/record-segments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a record segment */
        delete: operations["deleteRecordSegment"];
        options?: never;
        head?: never;
        /** Update a record segment */
        patch: operations["updateRecordSegment"];
        trace?: never;
    };
    "/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List records from a store */
        get: operations["listRecords"];
        put?: never;
        /** Create a descriptive record without requiring a file */
        post: operations["createRecord"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a single record by id */
        get: operations["getRecord"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/ai-assist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a non-mutating, review-required assistance draft for an archive record */
        post: operations["recordAiAssist"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List durable record attachments */
        get: operations["listRecordAttachments"];
        put?: never;
        /** Attach one or more files to a record */
        post: operations["uploadRecordAttachments"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a record attachment */
        delete: operations["deleteRecordAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/broadcast-metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read MOS/MXF broadcast metadata for an archive record */
        get: operations["getRecordBroadcastMetadata"];
        /** Create or update MOS/MXF broadcast metadata for an archive record */
        put: operations["putRecordBroadcastMetadata"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/change-impact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview record change impact */
        post: operations["previewRecordChangeImpact"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List team comments for an archive record */
        get: operations["listRecordComments"];
        put?: never;
        /** Create a team comment for an archive record */
        post: operations["createRecordComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/department-handoffs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a department handoff without changing record ownership */
        post: operations["createDepartmentHandoff"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/edit-claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the active edit claim for a record, if any */
        get: operations["getRecordEditClaim"];
        put?: never;
        /** Claim (or renew) a short-lived edit presence marker for a record */
        post: operations["claimRecordEdit"];
        /** Release the edit claim for a record */
        delete: operations["releaseRecordEditClaim"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/field-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List field requests for a record */
        get: operations["listRecordFieldRequests"];
        put?: never;
        /** Create a field-scoped missing-info request for a record */
        post: operations["createRecordFieldRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/field-sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the last recorded source (manual/template/csv/bulk) for each metadata field */
        get: operations["listRecordFieldSources"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/freeze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the freeze status of a record, if any */
        get: operations["getRecordFreeze"];
        put?: never;
        /** Freeze a record for review, blocking further writes at the API level (admins can still override) */
        post: operations["freezeRecord"];
        /** Unfreeze a record */
        delete: operations["unfreezeRecord"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List audit-backed change history for an archive record */
        get: operations["listRecordHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Merge duplicate records into this primary record; duplicates are soft-deleted (restorable via /trash/restore), their own files are never touched */
        post: operations["mergeRecords"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/merge-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview merging duplicate records into this primary record */
        post: operations["previewRecordMerge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List private notes for an archive record */
        get: operations["listRecordNotes"];
        put?: never;
        /** Create a private note for an archive record */
        post: operations["createRecordNote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List projects a record is linked to */
        get: operations["listRecordProjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/segments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List segments defined on a record */
        get: operations["listRecordSegments"];
        put?: never;
        /** Define a new segment on a record, no file copy */
        post: operations["createRecordSegment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List prior metadata snapshots for a record, newest first */
        get: operations["listRecordSnapshots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/snapshots/{snapshotId}/diff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Diff a prior snapshot against the record's current metadata */
        get: operations["diffRecordSnapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/snapshots/{snapshotId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore chosen metadata fields from a prior snapshot; files, rights, and share links are never touched */
        post: operations["restoreRecordSnapshot"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/source-replacements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replace a record source while preserving its identity */
        post: operations["replaceRecordSource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/source-versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List previous record sources */
        get: operations["listRecordSourceVersions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/source-versions/{versionId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore a previous record source */
        post: operations["restoreRecordSource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/transcript": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Persist an imported subtitle transcript for a record */
        patch: operations["updateRecordTranscript"];
        trace?: never;
    };
    "/records/{id}/transcript/subtitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Save edited timed subtitles and their presentation style on a record */
        put: operations["saveRecordSubtitles"];
        /** Import an SRT or WebVTT file into a record transcript */
        post: operations["importRecordSubtitles"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/{id}/triage-flag": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the quick-triage "needs info" flag for a record, if any */
        get: operations["getRecordTriageFlag"];
        /** Set or replace the quick-triage flag for a record */
        put: operations["setRecordTriageFlag"];
        post?: never;
        /** Clear the quick-triage flag for a record */
        delete: operations["clearRecordTriageFlag"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bulk upsert records for migration and sync compatibility */
        post: operations["bulkUpsertRecords"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/bulk-delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bulk delete records by id with per-item results */
        post: operations["bulkDeleteRecords"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream a CSV export of top-level record fields for a store */
        get: operations["exportRecordsCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/records/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import records from the same CSV shape as /records/export; update-only
         * @description Updates only rows whose uid already exists in the given store. Never creates a new uid, and never touches fields absent from the CSV header. ?dryRun=1 reports the same per-row outcome without writing.
         */
        post: operations["importRecordsCsv"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/relations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a manual relation between archive records */
        post: operations["createRecordRelation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/relations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a manual archive record relation */
        delete: operations["deleteRecordRelation"];
        options?: never;
        head?: never;
        /** Update a manual archive record relation */
        patch: operations["updateRecordRelation"];
        trace?: never;
    };
    "/relations/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return manual and inferred archive relation graph */
        get: operations["relationGraph"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/compliance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Generate an admin-only operational compliance report from audit events */
        get: operations["getComplianceReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/compliance/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export filtered operational compliance evidence as CSV without audit payloads */
        get: operations["exportComplianceReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/review-links/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a public visual review link */
        get: operations["getReviewLink"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fetch a rights record by archive item id */
        get: operations["getRightsByItem"];
        put?: never;
        /** Create or upsert a rights record */
        post: operations["upsertRights"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rights/{itemId}/enforcement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return rights enforcement status for an item */
        get: operations["getRightsEnforcement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rights/expiring": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List rights records expiring soon */
        get: operations["listExpiringRights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/safety-preview/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Run a destructive-operation preview against synthetic data
         * @description Executes only deterministic in-memory fixtures. It never reads, changes, restores, or deletes archive data.
         */
        post: operations["runSafetyPreview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/safety-preview/scenarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List deterministic synthetic safety-preview scenarios */
        get: operations["safetyPreviewScenarios"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saved-searches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List saved searches for the current user */
        get: operations["listSavedSearches"];
        put?: never;
        /** Create a saved search for the current user */
        post: operations["createSavedSearch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saved-searches/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a saved search */
        delete: operations["deleteSavedSearch"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saved-searches/{id}/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Replace explicit department access for an owned or editable saved search */
        put: operations["replaceSavedSearchAccess"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saved-searches/{id}/copy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Copy an accessible saved search into the current user's private searches */
        post: operations["copySavedSearch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search archive records */
        get: operations["searchRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/search/suggestions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return bounded authenticated search autocomplete suggestions */
        get: operations["searchSuggestions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/share": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a scoped public share link */
        post: operations["createShare"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/share/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a public share payload */
        get: operations["getShare"];
        put?: never;
        post?: never;
        /** Immediately revoke a share link */
        delete: operations["revokeShare"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/suggestions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return deterministic archive improvement suggestions */
        get: operations["listSuggestions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/suggestions/{key}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Persist current-user feedback for a suggestion */
        put: operations["submitSuggestionFeedback"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List sync log entries and conflict states */
        get: operations["listSyncLog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List backup files (admin only) */
        get: operations["listBackups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/backups/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview per-store record counts of a backup without restoring (admin only) */
        post: operations["previewBackup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/backups/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore record stores from a named backup (admin only) */
        post: operations["restoreBackup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/backups/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a backup of all record stores now (admin only) */
        post: operations["runBackup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/control/{action}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run a host control action (admin only, disabled unless SYSTEM_CONTROL_ENABLED=true server-side) */
        post: operations["runSystemControlAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/dr-probe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read disaster-recovery readiness (last backup, last restore test) (admin only) */
        get: operations["systemDrProbe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/dropbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read Dropbox connection status (admin only) */
        get: operations["getDropboxConnection"];
        put?: never;
        post?: never;
        /** Disconnect Dropbox (admin only) */
        delete: operations["disconnectDropbox"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/dropbox/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start Dropbox OAuth PKCE authorization (admin only) */
        post: operations["authorizeDropbox"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/dropbox/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Persist an OAuth callback token result (admin only) */
        post: operations["connectDropbox"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/dropbox/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Selectively import Dropbox folder changes using the saved cursor (admin only) */
        post: operations["syncDropbox"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/metrics/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the storage usage series behind the growth forecast (admin only) */
        get: operations["systemMetricsHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/odbc": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return ODBC bridge readiness */
        get: operations["getOdbcStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/odbc/tables/{table}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Preview an allowlisted ODBC core table */
        get: operations["getOdbcTablePreview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/odbc/tables/{table}/rows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Insert one row into an allowlisted ODBC core table */
        post: operations["createOdbcTableRow"];
        /** Delete a row from an allowlisted ODBC core table */
        delete: operations["deleteOdbcTableRow"];
        options?: never;
        head?: never;
        /** Update a row in an allowlisted ODBC core table */
        patch: operations["updateOdbcTableRow"];
        trace?: never;
    };
    "/system/security-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read runtime security settings (admin only) */
        get: operations["getSecuritySettings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update the runtime-mutable subset of security settings (admin only) */
        patch: operations["updateSecuritySettings"];
        trace?: never;
    };
    "/system/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read live host metrics and DR readiness (admin only) */
        get: operations["systemStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storage-operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start an idempotent storage operation (admin only) */
        post: operations["startStorageOperation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storage-operations/{operation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a storage operation (admin only) */
        get: operations["getStorageOperation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storage-operations/{operation}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel a storage operation (admin only) */
        post: operations["cancelStorageOperation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storage-operations/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a signed storage-operation preview (admin only) */
        post: operations["previewStorageOperation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List configured storage providers and capabilities (admin only) */
        get: operations["listStorageWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/storages/{storage}/folders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Browse a configured storage provider (admin only) */
        get: operations["browseStorageWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tag-nodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List tag hierarchy nodes for the current user */
        get: operations["listTagNodes"];
        put?: never;
        /** Create a tag hierarchy node for the current user */
        post: operations["createTagNode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tag-nodes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a tag hierarchy node */
        delete: operations["deleteTagNode"];
        options?: never;
        head?: never;
        /** Update a tag hierarchy node */
        patch: operations["updateTagNode"];
        trace?: never;
    };
    "/trash": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Browse trashed records
         * @description Records removed via /records/bulk-delete. Entries are permanently dropped by the scheduled trash:prune once older than the retention window (TRASH_RETENTION_DAYS, default 30). Any authenticated role may browse.
         */
        get: operations["listTrash"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/trash/purge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Permanently delete trashed records
         * @description Requires the admin role. Irreversible: destroys the last copy of the record held outside backups.
         */
        post: operations["purgeTrash"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/trash/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore trashed records to their prior state
         * @description Requires the editor role. Restores the original payload, syncVersion and timestamps. A record whose uid is live again is refused with restored=false and reason=conflict rather than overwriting it; the trash entry survives.
         */
        post: operations["restoreTrash"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List type definitions */
        get: operations["listTypes"];
        put?: never;
        /** Create or update a type definition */
        post: operations["storeType"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/types/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a type definition */
        get: operations["getType"];
        put?: never;
        post?: never;
        /** Delete a type definition */
        delete: operations["deleteType"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/upload-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List shareable upload links */
        get: operations["listUploadLinks"];
        put?: never;
        /** Issue a token-based shareable upload link */
        post: operations["createUploadLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/upload-links/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke a shareable upload link */
        post: operations["revokeUploadLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/upload-links/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Validate an upload link token (public, no archive session required) */
        get: operations["getUploadLink"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload a file and create an archive record */
        post: operations["uploadFile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/schedules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List scheduled uploads (cursor-paginated, scoped to the caller unless admin) */
        get: operations["listScheduledUploads"];
        put?: never;
        /** Stage a completed chunked-upload session as a scheduled upload */
        post: operations["createScheduledUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/schedules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a single scheduled upload */
        get: operations["getScheduledUpload"];
        put?: never;
        post?: never;
        /** Cancel a scheduled upload (idempotent once already cancelled) */
        delete: operations["cancelScheduledUpload"];
        options?: never;
        head?: never;
        /** Reschedule a scheduled upload's time (scheduledAt/timeZone only) */
        patch: operations["rescheduleScheduledUpload"];
        trace?: never;
    };
    "/uploads/schedules/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Requeue a failed scheduled upload that failed for an infrastructure reason */
        post: operations["retryScheduledUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a resumable chunked upload session for a large file */
        post: operations["createUploadSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/sessions/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a chunked upload session's resume state */
        get: operations["getUploadSession"];
        put?: never;
        post?: never;
        /** Abort a chunked upload session and delete its chunks */
        delete: operations["abortUploadSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/sessions/{sessionId}/chunks/{index}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Upload one chunk of a resumable upload session */
        put: operations["uploadSessionChunk"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/sessions/{sessionId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assemble a completed chunked upload session into an archive record */
        post: operations["completeUploadSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List users and pending invitations (admin only) */
        get: operations["listUsers"];
        put?: never;
        /** Invite a new user (admin only) */
        post: operations["inviteUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a user (admin only; self-deletion is rejected) */
        delete: operations["deleteUser"];
        options?: never;
        head?: never;
        /** Update a user's role (admin only) */
        patch: operations["updateUserRole"];
        trace?: never;
    };
    "/users/mentionable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List mentionable users for the @-mention picker (any authenticated role) */
        get: operations["listMentionableUsers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List vocabulary terms for the current user */
        get: operations["listVocabularyTerms"];
        put?: never;
        /** Create a vocabulary term for the current user */
        post: operations["createVocabularyTerm"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a vocabulary term */
        delete: operations["deleteVocabularyTerm"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/{id}/relink": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Relink (replace or remove) a vocabulary term across every affected record, then delete the term */
        post: operations["relinkVocabularyTerm"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/{id}/relink-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Preview records affected by deleting/renaming a vocabulary term */
        get: operations["previewVocabularyRelink"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/department-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Replace the approved vocabulary term preferences for one department */
        put: operations["replaceDepartmentVocabularyPreferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export vocabulary terms for the current user as CSV or JSON */
        get: operations["exportVocabularyTerms"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Import vocabulary terms from a CSV or JSON file, merging synonyms into existing terms */
        post: operations["importVocabularyTerms"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/kinds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the built-in and configured dictionary categories for the current user */
        get: operations["listVocabularyKinds"];
        /** Replace the additional dictionary categories for the current user */
        put: operations["replaceVocabularyKinds"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List webhook subscriptions (admin only, secrets never included) */
        get: operations["listWebhooks"];
        put?: never;
        /** Create a webhook subscription (admin only; URL is validated against SSRF) */
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a webhook subscription (admin only) */
        delete: operations["deleteWebhook"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AcceptInvitationRequest: {
            name: string;
            password: string;
        };
        AccountExport: {
            /** Format: date-time */
            exportedAt: string;
            intakeTemplates: {
                [key: string]: unknown;
            }[];
            recordComments: {
                [key: string]: unknown;
            }[];
            recordNotes: {
                [key: string]: unknown;
            }[];
            savedSearches: {
                [key: string]: unknown;
            }[];
            uploadLinks: {
                [key: string]: unknown;
            }[];
            user: {
                [key: string]: unknown;
            };
        };
        AccountExportResponse: components["schemas"]["OkEnvelope"] & {
            export: components["schemas"]["AccountExport"];
        };
        ActivityResponse: components["schemas"]["OkEnvelope"] & {
            entries: components["schemas"]["RecordHistoryEntry"][];
            filters: {
                event?: string | null;
                limit: number;
                /** @enum {string|null} */
                outcome?: "success" | "rejected" | "failed" | null;
                resourceId?: string | null;
                resourceType?: string | null;
            };
            pagination?: components["schemas"]["PaginationMeta"];
        };
        ApiKey: {
            /** Format: date-time */
            createdAt: string | null;
            id: string;
            /** Format: date-time */
            lastUsedAt?: string | null;
            name: string;
            /**
             * @description Effective role is always capped at editor; admin-capable keys are not allowed
             * @enum {string}
             */
            role: "editor" | "viewer";
        };
        ApiKeyCreateRequest: {
            name: string;
            /** @enum {string} */
            role: "editor" | "viewer";
        };
        ApiKeyCreateResponse: components["schemas"]["OkEnvelope"] & {
            apiKey: components["schemas"]["ApiKey"];
            /** @description Raw bearer token; only returned at creation time, stored hashed thereafter */
            token: string;
        };
        ApiKeysResponse: components["schemas"]["OkEnvelope"] & {
            apiKeys: components["schemas"]["ApiKey"][];
        };
        ArchiveRecord: {
            attachmentCount?: number;
            /** Format: date-time */
            createdAt?: string;
            description?: string;
            descriptorCompletion?: {
                complete: number;
                missing: ("title" | "description" | "type" | "tags")[];
                /** @enum {string} */
                status: "green" | "yellow" | "red";
                /** @constant */
                total: 4;
            };
            id: string;
            /** @default false */
            isDeleted?: boolean;
            match?: {
                excerpt?: string;
                /** @enum {string} */
                kind: "metadata" | "semantic" | "transcript";
                timestampSeconds?: number;
            };
            metadata?: {
                [key: string]: unknown;
            };
            path?: string;
            store?: string;
            subtype?: string | null;
            syncVersion?: number;
            tags?: string[];
            thumbnail?: string;
            title: string;
            transcript?: string;
            type?: string;
            uid?: string;
            /** Format: date-time */
            updatedAt?: string;
        } & {
            [key: string]: unknown;
        };
        ArchiveSuggestion: {
            actionHref: string;
            count: number;
            detail: string;
            key: string;
            /** @enum {string} */
            severity: "high" | "medium" | "low";
            title: string;
        };
        AuthResponse: components["schemas"]["OkEnvelope"] & {
            token?: string;
            user: components["schemas"]["User"];
        };
        AutomationRule: {
            action: components["schemas"]["AutomationRuleAction"];
            /** Format: date-time */
            createdAt?: string | null;
            departmentId: string;
            enabled: boolean;
            id: string;
            /** Format: date-time */
            lastRunAt?: string | null;
            name: string;
            query: string;
            status: string;
            tag: string;
            trigger: components["schemas"]["AutomationRuleTrigger"];
            type: string;
            /** Format: date-time */
            updatedAt?: string | null;
        };
        /** @enum {string} */
        AutomationRuleAction: "add-tag" | "set-review" | "notify-admin" | "create-inbox-item";
        AutomationRuleResponse: components["schemas"]["OkEnvelope"] & {
            rule: components["schemas"]["AutomationRule"];
        };
        AutomationRuleRun: {
            /** Format: date-time */
            createdAt?: string | null;
            dryRun: boolean;
            executedCount: number;
            id: string;
            matchedCount: number;
            message?: string | null;
            ruleId: string;
            sampleRecords?: {
                [key: string]: unknown;
            }[];
            status: string;
        };
        AutomationRuleRunResponse: components["schemas"]["OkEnvelope"] & {
            run: components["schemas"]["AutomationRuleRun"];
        };
        AutomationRulesResponse: components["schemas"]["OkEnvelope"] & {
            pagination?: components["schemas"]["PaginationMeta"];
            rules: components["schemas"]["AutomationRule"][];
            runs: components["schemas"]["AutomationRuleRun"][];
        };
        /** @enum {string} */
        AutomationRuleTrigger: "record.created" | "record.updated" | "media.failed" | "schedule.daily";
        BackupInfo: {
            /** Format: date-time */
            createdAt: string;
            name: string;
            sizeBytes: number;
        };
        BackupListResponse: components["schemas"]["OkEnvelope"] & {
            backups: components["schemas"]["BackupInfo"][];
        };
        BackupNameRequest: {
            name: string;
        };
        BackupPreviewResponse: components["schemas"]["OkEnvelope"] & {
            preview: {
                name: string;
                stores: {
                    [key: string]: number;
                };
                totalRecords: number;
            };
        };
        BackupRestoreResponse: components["schemas"]["OkEnvelope"] & {
            result: {
                counts: {
                    [key: string]: number;
                };
                name: string;
                /** Format: date-time */
                restoredAt: string;
                /** @description True when the backup's SHA-256 checksum was confirmed before restore. False for older backups with no checksum sidecar (structural validation only) — the restore still proceeded but its integrity is unverified. */
                verified: boolean;
            };
        };
        BackupRunResponse: components["schemas"]["OkEnvelope"] & {
            backup: {
                /** Format: date-time */
                completedAt: string;
                name: string;
                sizeBytes: number;
                stores: {
                    [key: string]: number;
                };
            };
        };
        BrokenLink: {
            missingSource: boolean;
            missingTarget: boolean;
            relationId: string;
            sourceRecordId: string;
            targetRecordId: string;
        };
        BulkDeleteRecordsRequest: {
            ids: string[];
            store: string;
        };
        BulkDeleteRecordsResponse: components["schemas"]["OkEnvelope"] & {
            count: number;
            results: {
                deleted: boolean;
                uid: string;
            }[];
        };
        BulkMacro: {
            /** Format: date-time */
            createdAt: string | null;
            /** Format: uuid */
            id: string;
            name: string;
            steps: components["schemas"]["BulkMacroStep"][];
            /** Format: date-time */
            updatedAt: string | null;
            version: number;
        };
        BulkMacroAddTagStep: {
            tag: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "add-tag";
        };
        BulkMacroDeleteResponse: components["schemas"]["OkEnvelope"] & {
            /** @constant */
            deleted: true;
        };
        BulkMacroDeleteStep: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "delete";
        };
        BulkMacroNotFoundError: components["schemas"]["ErrorEnvelope"] & {
            /** @constant */
            code: "not_found";
        };
        BulkMacroPreview: {
            /** Format: date-time */
            expiresAt: string;
            previewToken: string;
            results: components["schemas"]["BulkMacroTargetResult"][];
            summary: {
                affectedCount: number;
                missingCount: number;
                targetCount: number;
            };
        };
        BulkMacroPreviewError: components["schemas"]["ErrorEnvelope"] & {
            /** @enum {string} */
            code: "invalid_preview" | "expired_preview" | "stale_preview";
        };
        BulkMacroPreviewResponse: components["schemas"]["OkEnvelope"] & components["schemas"]["BulkMacroPreview"];
        BulkMacroResponse: components["schemas"]["OkEnvelope"] & {
            macro: components["schemas"]["BulkMacro"];
        };
        BulkMacroRun: {
            completedCount: number;
            /** Format: date-time */
            createdAt: string | null;
            failedCount: number;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            macroId: string;
            macroVersion: number;
            results: components["schemas"]["BulkMacroTargetResult"][];
            /** Format: uuid */
            retriedFromRunId?: string | null;
            targetCount: number;
            targets: components["schemas"]["BulkMacroTarget"][];
        };
        BulkMacroRunResponse: components["schemas"]["OkEnvelope"] & {
            run: components["schemas"]["BulkMacroRun"];
        };
        BulkMacroRunsResponse: components["schemas"]["OkEnvelope"] & {
            runs: components["schemas"]["BulkMacroRun"][];
        };
        BulkMacroSetRightsHolderStep: {
            rightsHolder: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "set-rights-holder";
        };
        BulkMacroSetWorkflowStatusStep: {
            status: components["schemas"]["BulkMacroWorkflowStatus"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "set-workflow-status";
        };
        BulkMacrosResponse: components["schemas"]["OkEnvelope"] & {
            macros: components["schemas"]["BulkMacro"][];
        };
        BulkMacroStep: components["schemas"]["BulkMacroAddTagStep"] | components["schemas"]["BulkMacroSetWorkflowStatusStep"] | components["schemas"]["BulkMacroDeleteStep"] | components["schemas"]["BulkMacroSetRightsHolderStep"];
        BulkMacroStepOutcome: {
            after?: unknown;
            before?: unknown;
            index: number;
            /** @enum {string} */
            reason?: "deleted" | "mutation_failed" | "target_failed";
            reversible?: boolean;
            /** @enum {string} */
            status: "would_apply" | "completed" | "skipped" | "failed";
            type: components["schemas"]["BulkMacroStepType"];
        };
        /** @enum {string} */
        BulkMacroStepType: "add-tag" | "set-workflow-status" | "delete" | "set-rights-holder";
        BulkMacroTarget: {
            id: string;
            store: string;
        };
        BulkMacroTargetResult: {
            id: string;
            /** @enum {string} */
            reason?: "target_failed" | "event_dispatch_failed";
            /** @enum {string} */
            status: "ready" | "missing" | "completed" | "partial" | "failed";
            steps: components["schemas"]["BulkMacroStepOutcome"][];
            store: string;
        };
        BulkMacroTargetsRequest: {
            targets: components["schemas"]["BulkMacroTarget"][];
        };
        BulkMacroValidationError: components["schemas"]["ErrorEnvelope"] & {
            /** @constant */
            code: "validation_failed";
        };
        /** @enum {string} */
        BulkMacroWorkflowStatus: "draft" | "editing" | "review" | "approved" | "published" | "archived";
        BulkRecordsRequest: {
            records: components["schemas"]["ArchiveRecord"][];
            store: string;
        };
        CollaborationDocument: {
            content: string;
            resourceId: string;
            roomKey: string;
            /** Format: date-time */
            updatedAt?: string | null;
            updatedByDisplayName?: string | null;
            version: number;
        };
        CollaborationDocumentResponse: components["schemas"]["OkEnvelope"] & {
            document: components["schemas"]["CollaborationDocument"];
            roomKey: string;
        };
        CollaborationDocumentUpdateRequest: {
            content: string;
            version: number;
        };
        CollaborationHeartbeatRequest: {
            cursor?: {
                [key: string]: unknown;
            };
            resourceId?: string;
            status?: components["schemas"]["CollaborationStatus"];
        };
        CollaborationLock: {
            displayName: string;
            /** Format: date-time */
            expiresAt?: string | null;
            id: string;
            resourceId: string;
            roomKey: string;
            /** Format: date-time */
            updatedAt?: string | null;
            userId: string;
        };
        CollaborationLockAcquireResponse: components["schemas"]["CollaborationLocksResponse"] & {
            lock: components["schemas"]["CollaborationLock"];
        };
        CollaborationLockReleaseRequest: {
            resourceId: string;
        };
        CollaborationLockReleaseResponse: components["schemas"]["CollaborationLocksResponse"] & {
            released: boolean;
        };
        CollaborationLockRequest: {
            resourceId: string;
            /** @default 90 */
            ttlSeconds?: number;
        };
        CollaborationLocksResponse: components["schemas"]["OkEnvelope"] & {
            locks: components["schemas"]["CollaborationLock"][];
            roomKey: string;
        };
        CollaborationParticipant: {
            cursor?: {
                [key: string]: unknown;
            } | null;
            displayName: string;
            id: string;
            /** Format: date-time */
            lastSeenAt?: string | null;
            resourceId?: string | null;
            roomKey: string;
            status: components["schemas"]["CollaborationStatus"];
            userId: string;
        };
        CollaborationPresenceResponse: components["schemas"]["OkEnvelope"] & {
            activeWindowSeconds: number;
            participants: components["schemas"]["CollaborationParticipant"][];
            roomKey: string;
        };
        /** @enum {string} */
        CollaborationStatus: "active" | "viewing" | "reviewing" | "editing" | "idle";
        Collection: {
            /** Format: date-time */
            createdAt: string | null;
            icon?: string | null;
            id: string;
            name: string;
            query: string | null;
            tag: string;
            type: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        CollectionCreateRequest: {
            icon?: string;
            name: string;
            query?: string;
            tag?: string;
            type?: string;
        };
        CollectionRecordsResponse: components["schemas"]["OkEnvelope"] & {
            recordIds: string[];
        };
        CollectionResponse: components["schemas"]["OkEnvelope"] & {
            collection: components["schemas"]["Collection"];
        };
        CollectionsResponse: components["schemas"]["OkEnvelope"] & {
            collections: components["schemas"]["Collection"][];
        };
        CollectionUpdateRequest: {
            icon?: string | null;
            name?: string;
            query?: string | null;
            tag?: string | null;
            type?: string | null;
        };
        ComplianceReportEntry: {
            action: string;
            actorId: string | null;
            /** Format: date-time */
            createdAt: string | null;
            event: string;
            id: number | string;
            /** @enum {string} */
            outcome: "success" | "rejected" | "failed";
            resourceId: string | null;
            resourceType: string | null;
            statusCode: number;
        };
        ComplianceReportResponse: components["schemas"]["OkEnvelope"] & {
            entries: components["schemas"]["ComplianceReportEntry"][];
            filters: {
                [key: string]: unknown;
            };
            summary: components["schemas"]["ComplianceReportSummary"];
        };
        ComplianceReportSummary: {
            events: {
                [key: string]: number;
            };
            outcomes: {
                [key: string]: number;
            };
            resourceTypes: {
                [key: string]: number;
            };
            total: number;
        };
        CreateAutomationRuleRequest: {
            action: components["schemas"]["AutomationRuleAction"];
            departmentId?: string;
            /** @default true */
            enabled?: boolean;
            name: string;
            query?: string;
            status?: string;
            tag?: string;
            trigger: components["schemas"]["AutomationRuleTrigger"];
            type?: string;
        };
        CreateBulkMacroRequest: {
            name: string;
            steps: components["schemas"]["BulkMacroStep"][];
        };
        /** @description New projects are always created with status 'draft'; unknown extra fields are ignored by the server. */
        CreateMontageProjectRequest: {
            clips?: Record<string, never>[] | null;
            comments?: Record<string, never>[] | null;
            description?: string | null;
            fps?: number | null;
            markers?: Record<string, never>[] | null;
            name: string;
            tracks?: Record<string, never>[] | null;
            transitions?: Record<string, never>[] | null;
        };
        CreateRecordRelationRequest: {
            note?: string;
            sourceId: string;
            targetId: string;
            type: components["schemas"]["RelationType"];
        };
        CreateReviewLinkRequest: {
            /** Format: date-time */
            expiresAt?: string | null;
            /**
             * @default view
             * @enum {string}
             */
            permission?: "view" | "comment";
        };
        CreateReviewLinkResponse: components["schemas"]["OkEnvelope"] & {
            /** Format: date-time */
            expiresAt?: string | null;
            mediaUid: string;
            path: string;
            /** @enum {string} */
            permission: "view" | "comment";
            token: string;
            url: string;
        };
        CreateScheduledUploadRequest: {
            idempotencyKey: string;
            record: components["schemas"]["ScheduledUploadRecordPayload"];
            /** Format: date-time */
            scheduledAt: string;
            /** @description IANA time zone identifier. */
            timeZone: string;
            uploadSessionId: string;
        };
        CreateShareRequest: {
            /** Format: date-time */
            expiresAt?: string | null;
            password?: string;
            /**
             * @default view
             * @enum {string}
             */
            permission?: "view" | "comment";
            scope: {
                collectionIds?: string[];
                itemIds?: string[];
            } & {
                [key: string]: unknown;
            };
        };
        CreateShareResponse: components["schemas"]["OkEnvelope"] & {
            /** Format: date-time */
            expiresAt?: string | null;
            path?: string;
            token: string;
            url: string;
        };
        CreateUploadSessionRequest: {
            /** @description Optional sha256 of the full file, verified after assembly. */
            checksum?: string;
            chunkSize: number;
            fileName: string;
            folder?: string;
            totalSize: number;
        };
        DepartmentFieldOwner: {
            departmentId: string;
            field: string;
            id: string;
            owner: string;
        };
        DepartmentFieldOwnersRequest: {
            departmentId: string;
            owners: {
                field: string;
                owner: string;
            }[];
        };
        DepartmentFieldOwnersResponse: components["schemas"]["OkEnvelope"] & {
            owners: components["schemas"]["DepartmentFieldOwner"][];
        };
        DepartmentHandoff: {
            fromDepartmentId?: string;
            id?: string;
            receivedBy?: string | null;
            recordId?: string;
            sentBy?: string;
            summary?: {
                [key: string]: unknown;
            };
            toDepartmentId?: string;
        };
        DepartmentHandoffRequest: {
            fromDepartmentId: string;
            receivedBy?: string;
            toDepartmentId: string;
        };
        DepartmentHandoffResponse: components["schemas"]["OkEnvelope"] & {
            handoff?: components["schemas"]["DepartmentHandoff"];
        };
        DepartmentQualityPreviewRequest: {
            departmentId: string;
            metadata?: {
                [key: string]: unknown;
            };
            typeId?: string | null;
        };
        DepartmentQualityPreviewResponse: components["schemas"]["OkEnvelope"] & {
            missingFields: string[];
            ready: boolean;
            ruleId?: string | null;
        };
        DepartmentQualityRule: {
            departmentId: string;
            enabled: boolean;
            id: string;
            requiredFields: string[];
            typeId: string | null;
        };
        DepartmentQualityRuleInput: {
            departmentId: string;
            enabled?: boolean;
            requiredFields: string[];
            typeId?: string | null;
        };
        DepartmentQualityRuleResponse: components["schemas"]["OkEnvelope"] & {
            rule: components["schemas"]["DepartmentQualityRule"];
        };
        DepartmentQualityRulesResponse: components["schemas"]["OkEnvelope"] & {
            rules: components["schemas"]["DepartmentQualityRule"][];
        };
        DepartmentRoutingPreview: {
            blocked: boolean;
            fromDepartmentId: string | null;
            reason?: string | null;
            toDepartmentId: string;
        };
        DepartmentRoutingRequest: {
            departmentId: string;
        };
        DepartmentTemplateMetrics: {
            departmentId: string;
            missingFieldCounts: {
                [key: string]: number;
            };
            publishedTemplateCount: number;
            qualityRuleCount: number;
            recordCount: number;
            templateCount: number;
        };
        DepartmentTemplateMetricsResponse: components["schemas"]["OkEnvelope"] & {
            metrics: components["schemas"]["DepartmentTemplateMetrics"];
        };
        DepartmentVocabularyPreferencesRequest: {
            departmentId: string;
            termIds: string[];
        };
        DiscoverResponse: components["schemas"]["OkEnvelope"] & {
            sections: components["schemas"]["DiscoverSection"][];
        };
        DiscoverSection: {
            count: number;
            description: string;
            /** @enum {string} */
            key: "explore" | "trending" | "random" | "active" | "forgotten" | "needsMetadata";
            label: string;
            records: components["schemas"]["ArchiveRecord"][];
        };
        DropboxAuthorizationResponse: components["schemas"]["OkEnvelope"] & {
            /** Format: uri */
            authorizationUrl: string;
        };
        DropboxConnection: {
            configured: boolean;
            folderPath: string | null;
            /** @enum {string} */
            status: "disabled" | "disconnected" | "connected";
        };
        DropboxConnectionResponse: components["schemas"]["OkEnvelope"] & {
            dropbox: components["schemas"]["DropboxConnection"];
        };
        DropboxConnectRequest: {
            accessToken: string;
            /** Format: date-time */
            expiresAt?: string;
            folderPath?: string;
            refreshToken?: string;
        };
        DropboxSyncResponse: components["schemas"]["OkEnvelope"] & {
            sync: {
                cursor: string | null;
                entries: {
                    id: string | null;
                    path: string;
                    size: number | null;
                }[];
                hasMore: boolean;
            };
        };
        DrProbe: {
            /** Format: date-time */
            lastBackupAt: string | null;
            lastBackupName: string | null;
            /** Format: date-time */
            lastRestoreTestAt: string | null;
            lastRestoreTestOk: boolean | null;
        };
        DrProbeResponse: components["schemas"]["OkEnvelope"] & {
            dr: components["schemas"]["DrProbe"];
        };
        EntityRef: {
            id: string;
            type: string;
        };
        ErrorEnvelope: {
            code?: string;
            details?: unknown;
            error: string;
            /** @constant */
            ok: false;
        };
        FavoriteCreateRequest: {
            recordId: string;
            /** @default archive-items */
            store?: string;
        };
        FavoriteResponse: components["schemas"]["OkEnvelope"] & {
            favorite: components["schemas"]["SavedFavorite"];
        };
        FavoritesResponse: components["schemas"]["OkEnvelope"] & {
            favorites: components["schemas"]["SavedFavorite"][];
        };
        FileBrowserResponse: components["schemas"]["OkEnvelope"] & {
            entries: components["schemas"]["FileEntry"][];
            path: string;
        };
        FileEntry: {
            key: string;
            /** @enum {string} */
            kind: "file" | "folder";
            mimeType?: string;
            /** Format: date-time */
            modifiedAt?: string;
            name: string;
            path?: string;
            size?: number;
            url?: string;
        } & {
            [key: string]: unknown;
        };
        FileHealthCheck: {
            /** Format: uuid */
            attachmentId: string;
            /** Format: date-time */
            checkedAt: string;
            checksumSha256: string | null;
            id: string;
            /** @enum {string} */
            status: "match" | "mismatch" | "missing" | "error";
        };
        FileHealthCheckResponse: components["schemas"]["OkEnvelope"] & {
            check: components["schemas"]["FileHealthCheck"];
        };
        FileHealthChecksResponse: components["schemas"]["OkEnvelope"] & {
            checks: components["schemas"]["FileHealthCheck"][];
        };
        FileListResponse: components["schemas"]["OkEnvelope"] & {
            files: components["schemas"]["FileEntry"][];
        };
        FileWriteResponse: components["schemas"]["OkEnvelope"] & {
            key?: string;
            url?: string;
        };
        Folder: {
            /** Format: date-time */
            createdAt?: string;
            entityRefs?: components["schemas"]["EntityRef"][];
            id: string;
            itemIds?: string[];
            name: string;
            parentId?: string | null;
            /** Format: date-time */
            updatedAt?: string;
        } & {
            [key: string]: unknown;
        };
        FolderListResponse: components["schemas"]["OkEnvelope"] & {
            folders: components["schemas"]["Folder"][];
        };
        FtpPullRequest: {
            host: string;
            localPath?: string;
            password: string;
            port?: number;
            remotePath?: string;
            secure?: boolean;
            user: string;
        };
        HealthResponse: components["schemas"]["OkEnvelope"] & {
            authRequired?: boolean;
            backend: string;
            db?: {
                error?: string;
                latencyMs?: number;
                ok?: boolean;
            };
            engine: string;
            uptimeSec: number;
            version?: string;
        };
        ImportPreview: {
            contentLength: number | null;
            contentType: string;
            suggestedTitle: string;
            /** @enum {string} */
            suggestedType: "video" | "image" | "audio" | "document" | "file";
            /** Format: uri */
            url: string;
        };
        ImportPreviewRequest: {
            /** Format: uri */
            url: string;
        };
        ImportPreviewResponse: components["schemas"]["OkEnvelope"] & {
            preview: components["schemas"]["ImportPreview"];
        };
        InboxItem: {
            /** Format: date-time */
            createdAt: string | null;
            departmentId: string | null;
            id: string;
            note: string | null;
            routingHistory: {
                /** Format: date-time */
                at: string;
                from: string | null;
                to: string;
            }[];
            source: string | null;
            status: components["schemas"]["InboxStatus"];
            title: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        InboxItemCreateRequest: {
            note?: string;
            source?: string;
            status?: components["schemas"]["InboxStatus"];
            title: string;
        };
        InboxItemResponse: components["schemas"]["OkEnvelope"] & {
            item: components["schemas"]["InboxItem"];
        };
        InboxItemsResponse: components["schemas"]["OkEnvelope"] & {
            items: components["schemas"]["InboxItem"][];
        };
        InboxItemUpdateRequest: {
            note?: string | null;
            source?: string | null;
            status?: components["schemas"]["InboxStatus"];
            title?: string;
        };
        /** @enum {string} */
        InboxStatus: "new" | "triage" | "ready" | "done";
        IngestedFile: {
            checksum: string;
            fileName: string;
            id: string;
        };
        IngestScanResponse: components["schemas"]["OkEnvelope"] & {
            ingested: components["schemas"]["IngestedFile"][];
            skipped: number;
        };
        IntakeTemplate: {
            /** Format: date-time */
            createdAt: string | null;
            createdBy: string | null;
            fields: Record<string, never>;
            id: string;
            name: string;
            type: string | null;
            /** Format: date-time */
            updatedAt: string | null;
        };
        IntakeTemplateCreateRequest: {
            fields: Record<string, never>;
            name: string;
            type?: string;
        };
        IntakeTemplateResponse: components["schemas"]["OkEnvelope"] & {
            template: components["schemas"]["IntakeTemplate"];
        };
        IntakeTemplatesResponse: components["schemas"]["OkEnvelope"] & {
            templates: components["schemas"]["IntakeTemplate"][];
        };
        InviteUserRequest: {
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "admin" | "editor" | "viewer";
        };
        InviteUserResponse: components["schemas"]["OkEnvelope"] & {
            invitation: components["schemas"]["UserInvitation"];
            /** @description One-time invitation token; only returned at creation time */
            token: string;
        };
        /** @enum {string} */
        LicenseType: "OWNED" | "LICENSED" | "PUBLIC_DOMAIN" | "FAIR_USE" | "UNKNOWN";
        LinkAuditResponse: components["schemas"]["OkEnvelope"] & {
            brokenLinks: components["schemas"]["BrokenLink"][];
        };
        LoginRequest: {
            password: string;
            /** @default false */
            rememberMe?: boolean;
            totp?: string;
            username: string;
        };
        MediaJob: {
            /** Format: date-time */
            completedAt?: string | null;
            /** @description Version of the persisted media job and result envelope. */
            contractVersion?: number;
            error?: string | null;
            /** @description Versioned compute executor selected by Laravel when the job was queued. */
            executor?: string;
            id: string;
            operation: components["schemas"]["MediaOperation"];
            options?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            queuedAt?: string | null;
            recordId: string;
            result?: {
                [key: string]: unknown;
            } | null;
            sourcePath?: string | null;
            /** Format: date-time */
            startedAt?: string | null;
            /** @enum {string} */
            status: "queued" | "processing" | "completed" | "failed";
        };
        MediaJobRequest: {
            operation: components["schemas"]["MediaOperation"];
            options?: {
                [key: string]: unknown;
            };
            recordId: string;
            sourcePath?: string | null;
        };
        MediaJobResponse: components["schemas"]["OkEnvelope"] & {
            job: components["schemas"]["MediaJob"];
        };
        /** @enum {string} */
        MediaOperation: "thumbnail" | "transcode" | "transcription" | "ocr" | "montage_export";
        MentionableUser: {
            id: string;
            name: string;
        };
        MentionableUsersResponse: components["schemas"]["OkEnvelope"] & {
            users: components["schemas"]["MentionableUser"][];
        };
        MetadataTemplate: {
            /** Format: date-time */
            createdAt: string;
            createdById?: string | null;
            currentVersion: number;
            departmentId: string | null;
            enabled: boolean;
            fields: {
                [key: string]: unknown;
            };
            id: string;
            name: string;
            /** Format: date-time */
            publishedAt?: string | null;
            publishedById?: string | null;
            publishedVersion?: number | null;
            tags: string[];
            typeId: string | null;
            /** Format: date-time */
            updatedAt: string;
            updatedById?: string | null;
            usageRoles: ("viewer" | "editor" | "admin")[];
        };
        MetadataTemplateCreateRequest: {
            departmentId: string | null;
            enabled?: boolean;
            fields?: {
                [key: string]: unknown;
            };
            name: string;
            tags?: string[];
            typeId?: string | null;
            usageRoles?: ("viewer" | "editor" | "admin")[];
        };
        MetadataTemplateResponse: components["schemas"]["OkEnvelope"] & {
            template: components["schemas"]["MetadataTemplate"];
        };
        MetadataTemplatesResponse: components["schemas"]["OkEnvelope"] & {
            templates: components["schemas"]["MetadataTemplate"][];
        };
        MetadataTemplateUpdateRequest: {
            departmentId?: string | null;
            enabled?: boolean;
            fields?: {
                [key: string]: unknown;
            };
            name?: string;
            tags?: string[];
            typeId?: string | null;
            usageRoles?: ("viewer" | "editor" | "admin")[];
        };
        MetadataTemplateVersion: {
            /** Format: date-time */
            createdAt: string;
            createdById?: string | null;
            id: string;
            snapshot: components["schemas"]["MetadataTemplate"];
            version: number;
        };
        MetadataTemplateVersionsResponse: components["schemas"]["OkEnvelope"] & {
            versions: components["schemas"]["MetadataTemplateVersion"][];
        };
        MontageProject: {
            /** @description Timeline clips; item shape is client-defined and stored as-is. */
            clips: Record<string, never>[];
            comments: Record<string, never>[];
            /** Format: date-time */
            createdAt?: string | null;
            description?: string | null;
            /** @default 25 */
            fps: number;
            id: string;
            markers: Record<string, never>[];
            name: string;
            /** @enum {string} */
            status: "draft" | "finalized" | "archived";
            /** @description Timeline tracks; item shape is client-defined and stored as-is. */
            tracks: Record<string, never>[];
            transitions: Record<string, never>[];
            /** Format: date-time */
            updatedAt?: string | null;
        };
        MontageProjectResponse: components["schemas"]["OkEnvelope"] & {
            project: components["schemas"]["MontageProject"];
        };
        MontageProjectsResponse: components["schemas"]["OkEnvelope"] & {
            pagination: components["schemas"]["PaginationMeta"];
            projects: components["schemas"]["MontageProject"][];
        };
        NamingRule: {
            key: string;
            prefix: string;
            /** Format: date-time */
            updatedAt: string;
        };
        NamingRuleResponse: components["schemas"]["OkEnvelope"] & {
            rule: components["schemas"]["NamingRule"];
        };
        NamingRulesResponse: components["schemas"]["OkEnvelope"] & {
            rules: components["schemas"]["NamingRule"][];
        };
        NamingRuleUpsertRequest: {
            prefix: string;
        };
        OdbcProbe: {
            driverLoaded: boolean;
            dsn: string;
            enabled: boolean;
            error?: string;
            message?: string;
            status: components["schemas"]["OdbcProbeStatus"];
            tables: string[];
        };
        /** @enum {string} */
        OdbcProbeStatus: "disabled" | "missing-dsn" | "driver-unavailable" | "connected" | "failed";
        OdbcRowKeyRequest: {
            keyColumn: string;
            keyValue: string | number | boolean;
        };
        OdbcRowWriteRequest: {
            values: {
                [key: string]: string | number | boolean | null;
            };
        };
        OdbcStatusResponse: components["schemas"]["OkEnvelope"] & {
            odbc: components["schemas"]["OdbcProbe"];
        };
        OdbcTablePreviewResponse: components["schemas"]["OkEnvelope"] & {
            count: number;
            rows: {
                [key: string]: unknown;
            }[];
            table: string;
        };
        OdbcWriteResponse: components["schemas"]["OkEnvelope"] & {
            affected: number;
            /** @enum {string} */
            operation: "insert" | "update" | "delete";
            table: string;
        };
        OkEnvelope: {
            /** @constant */
            ok: true;
        };
        OnboardingProgress: {
            stages: components["schemas"]["OnboardingStage"][];
        };
        OnboardingProgressResponse: components["schemas"]["OkEnvelope"] & {
            progress: components["schemas"]["OnboardingProgress"];
        };
        OnboardingStage: {
            /** Format: date-time */
            completedAt: string | null;
            id: components["schemas"]["OnboardingStageId"];
            /** @enum {string} */
            status: "pending" | "completed";
        };
        /** @enum {string} */
        OnboardingStageId: "organization" | "storage" | "invitation" | "first_record" | "first_search";
        PaginationMeta: {
            /** @description True when additional pages exist beyond this one. */
            hasMore: boolean;
            limit: number;
            page: number;
            /** @description Total matching rows across all pages. */
            total: number;
        };
        PluginCatalogItem: {
            /** @enum {string} */
            category: "metadata" | "workflow" | "ai" | "integration";
            id: string;
            name: string;
            permissions: components["schemas"]["PluginPermission"][];
            securityReview: components["schemas"]["PluginSecurityReview"];
            /** @enum {string} */
            status: "reviewed" | "draft" | "blocked";
            summary: string;
            trustLevel: string;
            vendor: string;
            version: string;
        };
        PluginCatalogResponse: components["schemas"]["OkEnvelope"] & {
            permissionScopes: components["schemas"]["PluginPermissionScopeSummary"][];
            plugins: components["schemas"]["PluginCatalogItem"][];
            runtimePolicy: components["schemas"]["PluginRuntimePolicy"];
        };
        PluginPermission: {
            reason: string;
            /** @enum {string} */
            risk: "low" | "medium" | "high";
            scope: string;
        };
        PluginPermissionScopeSummary: {
            pluginCount: number;
            /** @enum {string} */
            risk: "low" | "medium" | "high";
            scope: string;
        };
        PluginRuntimePolicy: {
            allowsCodeExecution: boolean;
            allowsRemoteInstall: boolean;
            description: string;
            mode: string;
            requiresAdminReview: boolean;
        };
        PluginSecurityReview: {
            adminApprovalRequired: boolean;
            dataLeavesTenant: boolean;
            executesCode: boolean;
            fileSystemAccess: boolean;
            networkAccess: boolean;
        };
        Project: {
            /** Format: date-time */
            createdAt: string;
            id: string;
            name: string;
            notes: string | null;
            sortOrder: number;
            /** Format: date-time */
            updatedAt: string;
        };
        ProjectCreateRequest: {
            name: string;
            notes?: string | null;
        };
        ProjectRecordOrderRequest: {
            recordIds: string[];
        };
        ProjectRecordsResponse: components["schemas"]["OkEnvelope"] & {
            recordIds: string[];
            records: {
                position: number;
                recordId: string;
            }[];
        };
        ProjectResponse: components["schemas"]["OkEnvelope"] & {
            project: components["schemas"]["Project"];
        };
        ProjectsResponse: components["schemas"]["OkEnvelope"] & {
            projects: components["schemas"]["Project"][];
        };
        ProjectTask: {
            assignee: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date */
            dueDate: string | null;
            id: string;
            projectId: string;
            recordId: string | null;
            /** @enum {string} */
            status: "todo" | "in_progress" | "review" | "done";
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ProjectTaskCreateRequest: {
            assignee?: string | null;
            /** Format: date */
            dueDate?: string | null;
            projectId: string;
            recordId?: string | null;
            /** @enum {string} */
            status?: "todo" | "in_progress" | "review" | "done";
            title: string;
        };
        ProjectTaskResponse: components["schemas"]["OkEnvelope"] & {
            task: components["schemas"]["ProjectTask"];
        };
        ProjectTasksResponse: components["schemas"]["OkEnvelope"] & {
            tasks: components["schemas"]["ProjectTask"][];
        };
        ProjectTaskUpdateRequest: {
            assignee?: string | null;
            /** Format: date */
            dueDate?: string | null;
            recordId?: string | null;
            /** @enum {string} */
            status?: "todo" | "in_progress" | "review" | "done";
            title?: string;
        };
        ProjectUpdateRequest: {
            name?: string;
            notes?: string | null;
            sortOrder?: number;
        };
        PublicCatalogRecord: {
            /** Format: date-time */
            createdAt?: string | null;
            description?: string | null;
            id: string;
            subtype?: string | null;
            tags: string[];
            title: string;
            type?: string | null;
            uid: string;
            /** Format: date-time */
            updatedAt?: string | null;
        };
        PublicCatalogResponse: components["schemas"]["OkEnvelope"] & {
            nextCursor?: string | null;
            records: components["schemas"]["PublicCatalogRecord"][];
        };
        RecordAiAssistResponse: components["schemas"]["OkEnvelope"] & {
            changesApplied: unknown[];
            entities: {
                kind: string;
                term: string;
            }[];
            proofreading: {
                code: string;
                message: string;
            }[];
            provider: string;
            recordId: string;
            /** @constant */
            reviewRequired: true;
            suggestedTags: string[];
            summary: string;
        };
        RecordAttachment: {
            checksumSha256: string;
            /** Format: date-time */
            createdAt?: string | null;
            /** Format: uuid */
            id: string;
            isPrimary: boolean;
            mimeType?: string | null;
            originalName: string;
            processingStatus: string;
            recordStore: string;
            recordUid: string;
            sizeBytes: number;
        };
        RecordAttachmentsResponse: components["schemas"]["OkEnvelope"] & {
            attachments: components["schemas"]["RecordAttachment"][];
        };
        RecordBroadcastMetadata: {
            itemId: string;
            mosObjectId?: string | null;
            mosProgramId?: string | null;
            mxfFormat?: string | null;
            mxfUmid?: string | null;
            raw?: {
                [key: string]: unknown;
            } | null;
            /** Format: date-time */
            updatedAt?: string | null;
        };
        RecordBroadcastMetadataRequest: {
            mosObjectId?: string | null;
            mosProgramId?: string | null;
            mxfFormat?: string | null;
            mxfUmid?: string | null;
            raw?: {
                [key: string]: unknown;
            };
        };
        RecordBroadcastMetadataResponse: components["schemas"]["OkEnvelope"] & {
            configured: boolean;
            integrations: {
                mos: boolean;
                mxf: boolean;
            };
            metadata: components["schemas"]["RecordBroadcastMetadata"] | null;
        };
        RecordChangeImpactResponse: components["schemas"]["OkEnvelope"] & {
            blocked: boolean;
            reason?: string | null;
            relations: Record<string, never>[];
            reports: number;
            segments: number;
            shares: number;
        };
        RecordComment: {
            authorId: string | null;
            authorName: string;
            body: string;
            /** Format: date-time */
            createdAt: string | null;
            id: string;
            itemId: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        RecordCommentCreateRequest: {
            body: string;
        };
        RecordCommentResponse: components["schemas"]["OkEnvelope"] & {
            comment: components["schemas"]["RecordComment"];
        };
        RecordCommentsResponse: components["schemas"]["OkEnvelope"] & {
            comments: components["schemas"]["RecordComment"][];
        };
        RecordCreateRequest: {
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** @default archive-items */
            store?: string;
            tags?: string[];
            title: string;
            type?: string;
        };
        RecordEditClaim: {
            claimedBy: string | null;
            claimedByName: string;
            /** Format: date-time */
            expiresAt: string;
            recordId: string;
        };
        RecordEditClaimResponse: components["schemas"]["OkEnvelope"] & {
            claim: components["schemas"]["RecordEditClaim"] | null;
        };
        RecordFieldRequest: {
            assignee: string | null;
            /** Format: date-time */
            createdAt: string;
            departmentId: string | null;
            /** Format: date */
            dueDate: string | null;
            field: string;
            fieldOwner: string | null;
            id: string;
            message: string;
            recordId: string;
            /** Format: date-time */
            resolvedAt: string | null;
            resolvedBy: string | null;
        };
        RecordFieldRequestCreateRequest: {
            assignee?: string | null;
            departmentId?: string | null;
            /** Format: date */
            dueDate?: string | null;
            field: string;
            message: string;
        };
        RecordFieldRequestResponse: components["schemas"]["OkEnvelope"] & {
            request: components["schemas"]["RecordFieldRequest"];
        };
        RecordFieldRequestsResponse: components["schemas"]["OkEnvelope"] & {
            requests: components["schemas"]["RecordFieldRequest"][];
        };
        RecordFieldSource: {
            field: string;
            /** @enum {string} */
            source: "manual" | "template" | "csv" | "bulk";
            /** Format: date-time */
            updatedAt: string;
        };
        RecordFieldSourcesResponse: components["schemas"]["OkEnvelope"] & {
            sources: components["schemas"]["RecordFieldSource"][];
        };
        RecordFreeze: {
            /** Format: date-time */
            createdAt: string;
            frozenBy: string | null;
            reason: string;
            recordId: string;
        };
        RecordFreezeRequest: {
            reason: string;
        };
        RecordFreezeResponse: components["schemas"]["OkEnvelope"] & {
            freeze: components["schemas"]["RecordFreeze"] | null;
        };
        RecordHistoryEntry: {
            action: string;
            actorId: string | null;
            /** Format: date-time */
            createdAt: string | null;
            event: string;
            id: number | string;
            /** @description Sanitized audit metadata. For a successful single-record bulk update, diff.before and diff.after contain only changed top-level fields; secret-like values are redacted or excluded. */
            metadata: Record<string, never> | null;
            outcome: string;
            resourceId: string | null;
            resourceType: string | null;
            statusCode: number;
        };
        RecordHistoryResponse: components["schemas"]["OkEnvelope"] & {
            entries: components["schemas"]["RecordHistoryEntry"][];
            pagination?: components["schemas"]["PaginationMeta"];
        };
        RecordListResponse: components["schemas"]["OkEnvelope"] & {
            nextCursor?: string | null;
            records: components["schemas"]["ArchiveRecord"][];
        };
        RecordMergePreviewResponse: components["schemas"]["OkEnvelope"] & {
            commentCount: number;
            duplicates: {
                found: boolean;
                id: string;
            }[];
            noteCount: number;
            primaryId: string;
            relationCount: number;
        };
        RecordMergeRequest: {
            duplicateIds: string[];
            store?: string;
        };
        RecordMergeResponse: components["schemas"]["OkEnvelope"] & {
            merged: string[];
            primaryId: string;
        };
        RecordNote: {
            authorId: string | null;
            authorName: string;
            body: string;
            /** Format: date-time */
            createdAt: string | null;
            id: string;
            itemId: string;
            region: components["schemas"]["RecordNoteRegion"] | null;
            timestampSeconds: number | null;
            /** Format: date-time */
            updatedAt: string | null;
        };
        RecordNoteCreateRequest: {
            body: string;
            region?: components["schemas"]["RecordNoteRegion"] | null;
            timestampSeconds?: number | null;
        };
        RecordNoteRegion: {
            h: number;
            w: number;
            x: number;
            y: number;
        };
        RecordNoteResponse: components["schemas"]["OkEnvelope"] & {
            note: components["schemas"]["RecordNote"];
        };
        RecordNotesResponse: components["schemas"]["OkEnvelope"] & {
            notes: components["schemas"]["RecordNote"][];
        };
        RecordNoteUpdateRequest: {
            body?: string;
            region?: components["schemas"]["RecordNoteRegion"] | null;
            timestampSeconds?: number | null;
        };
        RecordProjectsResponse: components["schemas"]["OkEnvelope"] & {
            projects: components["schemas"]["Project"][];
        };
        RecordRelation: {
            /** Format: date-time */
            createdAt?: string | null;
            id: string;
            label: string;
            note?: string | null;
            sourceId: string;
            targetId: string;
            type: components["schemas"]["RelationType"];
            /** Format: date-time */
            updatedAt?: string | null;
        };
        RecordRelationResponse: components["schemas"]["OkEnvelope"] & {
            relation: components["schemas"]["RecordRelation"];
        };
        RecordResponse: components["schemas"]["OkEnvelope"] & {
            record: components["schemas"]["ArchiveRecord"];
        };
        RecordSegment: {
            /** Format: date-time */
            createdAt: string;
            description: string;
            endSeconds: number | null;
            id: string;
            recordId: string;
            startSeconds: number | null;
            tags: string[];
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RecordSegmentCreateRequest: {
            description?: string;
            endSeconds?: number | null;
            startSeconds?: number | null;
            tags?: string[];
            title: string;
        };
        RecordSegmentResponse: components["schemas"]["OkEnvelope"] & {
            segment: components["schemas"]["RecordSegment"];
        };
        RecordSegmentsResponse: components["schemas"]["OkEnvelope"] & {
            segments: components["schemas"]["RecordSegment"][];
        };
        RecordSegmentUpdateRequest: {
            description?: string;
            endSeconds?: number | null;
            startSeconds?: number | null;
            tags?: string[];
            title?: string;
        };
        RecordsImportCsvResponse: components["schemas"]["OkEnvelope"] & {
            accepted: number;
            dryRun: boolean;
            rejected: number;
            results: {
                accepted: boolean;
                reason?: string;
                uid: string;
            }[];
        };
        RecordSnapshot: {
            changedBy: string | null;
            /** Format: date-time */
            createdAt: string;
            id: string;
            recordId: string;
        };
        RecordSnapshotDiffResponse: components["schemas"]["OkEnvelope"] & {
            fields: components["schemas"]["RecordSnapshotFieldDiff"][];
        };
        RecordSnapshotFieldDiff: {
            changed: boolean;
            current: unknown;
            field: string;
            previous: unknown;
        };
        RecordSnapshotRestoreRequest: {
            fields?: ("title" | "description" | "type" | "subtype" | "tags")[];
        };
        RecordSnapshotRestoreResponse: components["schemas"]["OkEnvelope"] & {
            restoredFields: string[];
        };
        RecordSnapshotsResponse: components["schemas"]["OkEnvelope"] & {
            snapshots: components["schemas"]["RecordSnapshot"][];
        };
        RecordSourceVersionsResponse: components["schemas"]["OkEnvelope"] & {
            versions: {
                createdAt: string;
                fileName: string;
                id: string;
            }[];
        };
        RecordTriageFlag: {
            /** Format: date-time */
            createdAt: string;
            flaggedBy: string | null;
            reason: string;
            recordId: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RecordTriageFlagResponse: components["schemas"]["OkEnvelope"] & {
            flag: components["schemas"]["RecordTriageFlag"] | null;
        };
        RecordTriageFlagUpsertRequest: {
            reason: string;
        };
        RelationGraphEdge: {
            id: string;
            /** @enum {string} */
            kind: "manual" | "shared-tag" | "same-type";
            label: string;
            note?: string | null;
            relationId?: string;
            sharedTags?: string[];
            sharedType?: string;
            source: string;
            target: string;
            type: string;
            weight: number;
        };
        RelationGraphNode: {
            degree: number;
            id: string;
            /** @enum {string} */
            kind: "item";
            label: string;
            record?: components["schemas"]["ArchiveRecord"];
            tags: string[];
            type: string;
            uid?: string;
        };
        RelationGraphResponse: components["schemas"]["OkEnvelope"] & {
            edges: components["schemas"]["RelationGraphEdge"][];
            nodes: components["schemas"]["RelationGraphNode"][];
            relationTypes: components["schemas"]["RelationTypeOption"][];
            stats: components["schemas"]["RelationGraphStats"];
        };
        RelationGraphStats: {
            edgeCount: number;
            focusId?: string | null;
            inferredEdgeCount: number;
            manualEdgeCount: number;
            nodeCount: number;
        };
        /** @enum {string} */
        RelationType: "is_part_of" | "contains" | "references" | "depends_on" | "related_to" | "alternative_of" | "copy_of" | "precedes" | "follows";
        RelationTypeOption: {
            bidirectional: boolean;
            inverse: string;
            key: components["schemas"]["RelationType"];
            label: string;
        };
        RescheduleUploadRequest: {
            /** Format: date-time */
            scheduledAt: string;
            /** @description IANA time zone identifier. */
            timeZone: string;
            version: number;
        };
        ReviewComment: {
            annotation?: components["schemas"]["ReviewRect"][] | null;
            author: string;
            body: string;
            /** Format: date-time */
            createdAt?: string | null;
            id: string;
            mediaUid: string;
            resolved: boolean;
            timecodeSeconds: number;
            /** Format: date-time */
            updatedAt?: string | null;
        };
        ReviewLinkPayloadResponse: components["schemas"]["OkEnvelope"] & {
            comments: components["schemas"]["ReviewComment"][];
            mediaUid: string;
            review: {
                /** Format: date-time */
                createdAt?: string | null;
                /** Format: date-time */
                expiresAt?: string | null;
                /** @enum {string} */
                permission: "view" | "comment";
                /** Format: date-time */
                updatedAt?: string | null;
            };
        };
        ReviewRect: {
            h: number;
            w: number;
            x: number;
            y: number;
        };
        RightsEnforcementResponse: components["schemas"]["OkEnvelope"] & ({
            allowed: boolean;
            blocked?: boolean;
            reason?: string;
            record?: components["schemas"]["RightsRecord"];
            warnings?: string[];
        } & {
            [key: string]: unknown;
        });
        RightsRecord: components["schemas"]["RightsRecordInput"] & {
            /** Format: date-time */
            createdAt: string;
            id: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RightsRecordInput: {
            /** Format: date-time */
            embargoEnd?: string | null;
            /** Format: date-time */
            embargoStart?: string | null;
            /** Format: date-time */
            expiresAt?: string | null;
            geoRestrictions?: string[];
            itemId: string;
            licenseType: components["schemas"]["LicenseType"];
            notes?: string | null;
            rightsHolder: string;
        };
        RightsRecordListResponse: components["schemas"]["OkEnvelope"] & {
            records: components["schemas"]["RightsRecord"][];
        };
        RightsRecordResponse: components["schemas"]["OkEnvelope"] & {
            record: components["schemas"]["RightsRecord"];
        };
        RunBulkMacroRequest: components["schemas"]["BulkMacroTargetsRequest"] & {
            previewToken: string;
        };
        SafetyPreviewCounts: {
            live: number;
            trash: number;
        };
        SafetyPreviewError: components["schemas"]["ErrorEnvelope"] & {
            /** @constant */
            synthetic: true;
        };
        /** @enum {string} */
        SafetyPreviewOperation: "delete" | "restore";
        SafetyPreviewResult: {
            deleted: boolean;
            id: string;
            /** @enum {string} */
            reason?: "not_found";
        } | {
            id: string;
            /** @enum {string} */
            reason?: "not_found" | "conflict";
            restored: boolean;
        };
        SafetyPreviewRunRequest: {
            ids: string[];
            operation: components["schemas"]["SafetyPreviewOperation"];
            scenario: components["schemas"]["SafetyPreviewScenario"];
        };
        SafetyPreviewRunResponse: components["schemas"]["OkEnvelope"] & {
            after: components["schemas"]["SafetyPreviewCounts"];
            before: components["schemas"]["SafetyPreviewCounts"];
            /** Format: date-time */
            expiresAt: string;
            operation: components["schemas"]["SafetyPreviewOperation"];
            results: components["schemas"]["SafetyPreviewResult"][];
            scenario: components["schemas"]["SafetyPreviewScenario"];
            /** @constant */
            synthetic: true;
        };
        /** @enum {string} */
        SafetyPreviewScenario: "bulk-delete-basic" | "restore-conflict";
        SafetyPreviewScenarioDescriptor: {
            /** @description Arabic description supplied by the Laravel preview service. */
            description: string;
            id: components["schemas"]["SafetyPreviewScenario"];
        };
        SafetyPreviewScenariosResponse: components["schemas"]["OkEnvelope"] & {
            scenarios: components["schemas"]["SafetyPreviewScenarioDescriptor"][];
            /** @constant */
            synthetic: true;
        };
        SavedFavorite: {
            /** Format: date-time */
            addedAt: string | null;
            recordId: string;
            store: string;
            title: string | null;
            type: string | null;
        };
        SavedSearch: {
            /** @enum {string} */
            accessRole: "owner" | "editor" | "viewer";
            canManage: boolean;
            /** Format: date-time */
            createdAt: string | null;
            departmentId: string | null;
            filters: Record<string, never> | null;
            id: string;
            members: components["schemas"]["SavedSearchMember"][];
            name: string;
            ownerId: string;
            query: string | null;
            shared: boolean;
            /** Format: date-time */
            updatedAt: string | null;
        };
        SavedSearchAccessRequest: {
            departmentId?: string;
            members: components["schemas"]["SavedSearchMember"][];
        };
        SavedSearchCreateRequest: {
            departmentId?: string;
            filters?: Record<string, never>;
            name: string;
            query?: string;
        };
        SavedSearchesResponse: components["schemas"]["OkEnvelope"] & {
            searches: components["schemas"]["SavedSearch"][];
        };
        SavedSearchMember: {
            /** @enum {string} */
            role: "editor" | "viewer";
            userId: string;
        };
        SavedSearchResponse: components["schemas"]["OkEnvelope"] & {
            search: components["schemas"]["SavedSearch"];
        };
        ScheduledUpload: {
            attempts: number;
            canCancel: boolean;
            canReschedule: boolean;
            canRetry: boolean;
            /** Format: date-time */
            createdAt: string | null;
            failureCode: string | null;
            failureMessage: string | null;
            fileName: string;
            id: string;
            recordId: string | null;
            /** Format: date-time */
            scheduledAt: string | null;
            status: components["schemas"]["ScheduledUploadStatus"];
            timeZone: string;
            title: string | null;
            /** Format: date-time */
            updatedAt: string | null;
            version: number;
        };
        ScheduledUploadCreateResponse: components["schemas"]["OkEnvelope"] & {
            schedule: components["schemas"]["ScheduledUploadStaged"];
        };
        ScheduledUploadListResponse: components["schemas"]["OkEnvelope"] & {
            nextCursor?: string | null;
            schedules: components["schemas"]["ScheduledUpload"][];
        };
        ScheduledUploadRecordPayload: {
            metadata?: {
                [key: string]: unknown;
            } | null;
            subtype?: string | null;
            tags?: string[] | null;
            title: string;
            type: string;
        };
        ScheduledUploadResponse: components["schemas"]["OkEnvelope"] & {
            schedule: components["schemas"]["ScheduledUpload"];
        };
        ScheduledUploadStaged: {
            fileName: string;
            id: string;
            record: components["schemas"]["ScheduledUploadRecordPayload"];
            /** Format: date-time */
            scheduledAt: string;
            status: components["schemas"]["ScheduledUploadStatus"];
            timeZone: string;
            totalSize: number;
        };
        /** @enum {string} */
        ScheduledUploadStatus: "scheduled" | "claimed" | "processing" | "completed" | "cancelled" | "failed";
        SearchFacetBucket: {
            count: number;
            label: string;
            value: string;
        };
        SearchFacets: {
            /**
             * @description 'advanced' is returned for validated field-query DSL searches and never uses semantic/vector search. 'semantic' is returned only when a pgvector query actually ran; semantic requests degrade to 'keyword-fallback' when unavailable (non-Postgres, pgvector missing, no embedding key, or embed failure). 'transcript' returns only time-coded VTT/SRT cue matches.
             * @enum {string}
             */
            mode: "keyword" | "keyword-fallback" | "semantic" | "advanced" | "transcript";
            statuses: components["schemas"]["SearchFacetBucket"][];
            store?: string | null;
            stores: components["schemas"]["SearchFacetBucket"][];
            subtypes: components["schemas"]["SearchFacetBucket"][];
            tags: components["schemas"]["SearchFacetBucket"][];
            total: number;
            types: components["schemas"]["SearchFacetBucket"][];
        } & {
            [key: string]: unknown;
        };
        SearchResponse: components["schemas"]["OkEnvelope"] & {
            facets: components["schemas"]["SearchFacets"];
            nextCursor?: string | null;
            records: components["schemas"]["ArchiveRecord"][];
        };
        SearchSuggestion: {
            /** @enum {string} */
            kind: "record" | "tag" | "type" | "recent";
            label: string;
            recordId?: string;
            value: string;
        };
        SearchSuggestionsResponse: components["schemas"]["OkEnvelope"] & {
            suggestions: components["schemas"]["SearchSuggestion"][];
        };
        SecuritySettings: {
            accessTokenTtlMinutes: number;
            /** @description Deploy-time only; read-only in the API */
            corsOrigins: string[];
            /** @description Deploy-time only; read-only in the API */
            cspPolicy: string;
            legacyPasswordUpgrade: boolean;
            perUserRateLimit: number;
            webhookUrlAllowlist: string[];
        };
        SecuritySettingsResponse: components["schemas"]["OkEnvelope"] & {
            settings: components["schemas"]["SecuritySettings"];
        };
        SharePayloadResponse: components["schemas"]["OkEnvelope"] & {
            comments?: {
                [key: string]: unknown;
            }[];
            permission?: string;
            records?: components["schemas"]["ArchiveRecord"][];
            scope: {
                [key: string]: unknown;
            };
        };
        SmbPullRequest: {
            domain?: string;
            localPath?: string;
            password: string;
            path?: string;
            share: string;
            user: string;
        };
        StorageBrowseResponse: components["schemas"]["OkEnvelope"] & {
            items: {
                id: string;
                /** @enum {string} */
                kind: "file" | "folder";
                /** Format: date-time */
                modifiedAt?: string | null;
                name: string;
                path: string;
                size?: number | null;
            }[];
            path: string;
        };
        StorageCatalogResponse: components["schemas"]["OkEnvelope"] & {
            storages: components["schemas"]["StorageProvider"][];
        };
        StorageOperationPreviewRequest: {
            action: string;
            destinationProviderId?: string;
            items: Record<string, never>[];
            sourceProviderId: string;
        };
        StorageOperationPreviewResponse: components["schemas"]["OkEnvelope"] & {
            preview: Record<string, never>;
        };
        StorageOperationResponse: components["schemas"]["OkEnvelope"] & {
            operation: Record<string, never>;
        };
        StorageProvider: {
            capabilities: string[];
            id: string;
            label: string;
            /** @enum {string} */
            status: "available" | "not_configured";
            /** @enum {string} */
            type: "local" | "s3" | "dropbox";
        };
        StorageSample: {
            /** Format: date-time */
            at: string;
            totalBytes: number;
            usedBytes: number;
        };
        SubtitleContentUpdateRequest: {
            content: string;
            /** @enum {string} */
            format: "srt" | "vtt";
            store?: string;
            style?: {
                /** @enum {string} */
                align?: "start" | "middle" | "end";
                color?: string;
                fontSize?: number;
            };
        };
        /** @enum {string} */
        SuggestionContext: "discover" | "search" | "detail";
        SuggestionFeedback: {
            context: components["schemas"]["SuggestionContext"];
            key: string;
            /** Format: date-time */
            updatedAt?: string | null;
            value: components["schemas"]["SuggestionFeedbackValue"];
        };
        SuggestionFeedbackRequest: {
            context?: components["schemas"]["SuggestionContext"];
            value: components["schemas"]["SuggestionFeedbackValue"];
        };
        SuggestionFeedbackResponse: components["schemas"]["OkEnvelope"] & {
            feedback: components["schemas"]["SuggestionFeedback"];
        };
        /** @enum {string} */
        SuggestionFeedbackValue: "useful" | "not-useful" | "dismissed";
        SuggestionsResponse: components["schemas"]["OkEnvelope"] & {
            context: components["schemas"]["SuggestionContext"];
            suggestions: components["schemas"]["ArchiveSuggestion"][];
        };
        SyncLogEntry: {
            lastModifiedBy: Record<string, never> | null;
            /** @enum {string} */
            status: "synced" | "conflict";
            store: string;
            syncVersion: number | null;
            uid: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        SyncLogResponse: components["schemas"]["OkEnvelope"] & {
            entries: components["schemas"]["SyncLogEntry"][];
            pagination?: components["schemas"]["PaginationMeta"];
            summary: components["schemas"]["SyncSummary"];
        };
        SyncSummary: {
            conflicts: number;
            synced: number;
            total: number;
        };
        SystemControlResponse: components["schemas"]["OkEnvelope"] & {
            result: {
                action: string;
                detail: {
                    [key: string]: unknown;
                };
            };
        };
        SystemMetrics: {
            cpuLoad: number[];
            disk: {
                totalBytes: number;
                usedBytes: number;
            };
            memory: {
                totalBytes: number;
                usedBytes: number;
            };
            queueDepth: number;
            /** @description V1-760: per-queue breakdown. queueDepth is the sum of every depth here; a queue appears once it has pending or failed work. */
            queues: {
                depth: number;
                failed: number;
                name: string;
                /** @description Age of the oldest pending job. 0 when the queue is idle — the signal that separates a stalled queue from a busy one. */
                oldestJobAgeSec: number;
            }[];
        };
        SystemMetricsHistoryResponse: components["schemas"]["OkEnvelope"] & {
            /** @description V1-756: storage measurements, oldest first. An unreadable disk is skipped at capture rather than stored as a zero, so the series never contains a fabricated collapse. */
            samples: components["schemas"]["StorageSample"][];
        };
        SystemStatusResponse: components["schemas"]["OkEnvelope"] & {
            dr: components["schemas"]["DrProbe"];
            metrics: components["schemas"]["SystemMetrics"];
        };
        TagNode: {
            /** Format: date-time */
            createdAt: string | null;
            icon?: string | null;
            id: string;
            parent: string;
            tag: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        TagNodeCreateRequest: {
            icon?: string;
            parent: string;
            tag: string;
        };
        TagNodeResponse: components["schemas"]["OkEnvelope"] & {
            node: components["schemas"]["TagNode"];
        };
        TagNodesResponse: components["schemas"]["OkEnvelope"] & {
            nodes: components["schemas"]["TagNode"][];
        };
        TagNodeUpdateRequest: {
            icon?: string | null;
            parent?: string;
            tag?: string;
        };
        TrashEntry: {
            /** Format: date-time */
            deletedAt: string;
            /** @description User id that deleted the record; null once that user is removed. */
            deletedBy?: number | null;
            /** @description Trash entry id, not the record id. */
            id: number;
            /** Format: date-time */
            originalCreatedAt?: string | null;
            /** Format: date-time */
            originalUpdatedAt?: string | null;
            /** @description The record payload exactly as it was at deletion. */
            record: {
                [key: string]: unknown;
            };
            store: string;
            syncVersion?: number | null;
            uid: string;
        };
        TrashListResponse: components["schemas"]["OkEnvelope"] & {
            items: components["schemas"]["TrashEntry"][];
            pagination: components["schemas"]["PaginationMeta"];
        };
        TrashPurgeResponse: components["schemas"]["OkEnvelope"] & {
            count: number;
            results: {
                purged: boolean;
                uid: string;
            }[];
        };
        TrashRestoreResponse: components["schemas"]["OkEnvelope"] & {
            /** @description How many entries were actually restored. */
            count: number;
            results: {
                /**
                 * @description Present only when restored is false.
                 * @enum {string}
                 */
                reason?: "not_found" | "conflict";
                restored: boolean;
                uid: string;
            }[];
        };
        TrashTargetsRequest: {
            /** @description Record uids as listed in the trash. */
            ids: string[];
            store: string;
        };
        TypeDefinition: {
            fields: components["schemas"]["TypeDefinitionField"][];
            icon?: string;
            id: string;
            name: string;
        };
        TypeDefinitionField: {
            condition?: components["schemas"]["TypeFieldCondition"];
            fieldAcl?: {
                edit?: string[] | null;
                view?: string[] | null;
            } | null;
            name: string;
            /** @enum {string} */
            type: "text" | "number" | "date" | "select" | "multi" | "boolean";
        };
        TypeFieldCondition: {
            equals: string | number | boolean;
            field: string;
        };
        TypeResponse: {
            /** @constant */
            ok: true;
            type: components["schemas"]["TypeDefinition"];
        };
        UnusedFile: {
            key: string;
            /** Format: date-time */
            modifiedAt: string;
            name: string;
            reason: string;
            size: number | null;
        };
        UnusedFilesResponse: components["schemas"]["OkEnvelope"] & {
            files: components["schemas"]["UnusedFile"][];
        };
        UpdateAutomationRuleRequest: {
            action?: components["schemas"]["AutomationRuleAction"];
            departmentId?: string;
            enabled?: boolean;
            name?: string;
            query?: string;
            status?: string;
            tag?: string;
            trigger?: components["schemas"]["AutomationRuleTrigger"];
            type?: string;
        };
        UpdateBulkMacroRequest: {
            name?: string;
            steps?: components["schemas"]["BulkMacroStep"][];
        };
        /** @description Fields sent as null are ignored (not cleared); unknown extra fields are ignored by the server. */
        UpdateMontageProjectRequest: {
            clips?: Record<string, never>[] | null;
            comments?: Record<string, never>[] | null;
            description?: string | null;
            fps?: number | null;
            markers?: Record<string, never>[] | null;
            name?: string | null;
            /** @enum {string|null} */
            status?: "draft" | "finalized" | "archived" | null;
            tracks?: Record<string, never>[] | null;
            transitions?: Record<string, never>[] | null;
        };
        UpdateOnboardingStageRequest: {
            /** @enum {string} */
            status: "pending" | "completed";
        };
        UpdateRecordRelationRequest: {
            note?: string | null;
            type?: components["schemas"]["RelationType"];
        };
        UpdateSecuritySettingsRequest: {
            accessTokenTtlMinutes?: number;
            legacyPasswordUpgrade?: boolean;
            perUserRateLimit?: number;
            webhookUrlAllowlist?: string[];
        };
        UpdateUserRoleRequest: {
            /** @enum {string} */
            role: "admin" | "editor" | "viewer";
        };
        UploadChunkResponse: components["schemas"]["OkEnvelope"] & {
            receivedChunks: number[];
            totalChunks: number;
        };
        UploadedRecord: {
            checksum: string;
            /** Format: date-time */
            createdAt?: string;
            fileName: string;
            filePath: string;
            id: string;
            /** @enum {string} */
            source: "upload";
            title: string;
            uid?: string;
            /** Format: date-time */
            updatedAt?: string;
        };
        UploadLink: {
            /** Format: date-time */
            createdAt: string | null;
            /** Format: date-time */
            expiresAt: string;
            folder: string | null;
            id: string;
            label: string | null;
            revoked: boolean;
            token?: string;
            uploadCount: number;
        };
        UploadLinkCreateRequest: {
            expiresInHours: number;
            folder?: string;
            label?: string;
        };
        UploadLinkResponse: components["schemas"]["OkEnvelope"] & {
            link: components["schemas"]["UploadLink"];
        };
        UploadLinksResponse: components["schemas"]["OkEnvelope"] & {
            links: components["schemas"]["UploadLink"][];
        };
        UploadRequest: {
            /** Format: binary */
            file: string;
            folder?: string;
        };
        UploadResponse: components["schemas"]["OkEnvelope"] & {
            record: components["schemas"]["UploadedRecord"];
        };
        UploadSession: {
            chunkSize: number;
            /** Format: date-time */
            expiresAt: string;
            fileName: string;
            id: string;
            receivedChunks: number[];
            /** @enum {string} */
            status: "pending" | "completed" | "aborted";
            totalChunks: number;
            totalSize: number;
        };
        UploadSessionResponse: components["schemas"]["OkEnvelope"] & {
            session: components["schemas"]["UploadSession"];
        };
        User: {
            displayName?: string;
            /** Format: email */
            email?: string;
            id: string;
            /** @enum {string} */
            role: "admin" | "editor" | "viewer";
            totpEnabled?: boolean;
            totpRecoveryCodesRemaining?: number;
            username: string;
        };
        UserAccount: {
            /** Format: date-time */
            createdAt?: string | null;
            /** Format: email */
            email: string;
            id: string;
            name: string;
            /** @enum {string} */
            role: "admin" | "editor" | "viewer";
        };
        UserAccountResponse: components["schemas"]["OkEnvelope"] & {
            user: components["schemas"]["UserAccount"];
        };
        UserInvitation: {
            /** Format: date-time */
            createdAt?: string | null;
            /** Format: email */
            email: string;
            /** Format: date-time */
            expiresAt: string;
            id: string;
            /** @enum {string} */
            role: "admin" | "editor" | "viewer";
        };
        UsersListResponse: components["schemas"]["OkEnvelope"] & {
            invitations: components["schemas"]["UserInvitation"][];
            users: components["schemas"]["UserAccount"][];
        };
        VocabularyImportResponse: components["schemas"]["OkEnvelope"] & {
            created: number;
            diff: {
                created: string[];
                merged: string[];
            };
            dryRun: boolean;
            merged: number;
        };
        VocabularyKind: {
            builtIn: boolean;
            description: string | null;
            icon: string | null;
            key: string;
            label: string;
            order: number;
        };
        VocabularyKindsReplaceRequest: {
            kinds: {
                description?: string | null;
                icon?: string | null;
                key: string;
                label: string;
                order?: number;
            }[];
        };
        VocabularyKindsResponse: components["schemas"]["OkEnvelope"] & {
            kinds: components["schemas"]["VocabularyKind"][];
        };
        VocabularyRelinkPreviewResponse: components["schemas"]["OkEnvelope"] & {
            affectedCount: number;
            records: {
                id: string;
                title: string;
            }[];
            term: string;
        };
        VocabularyRelinkRequest: {
            replacement?: string | null;
        };
        VocabularyRelinkResponse: components["schemas"]["OkEnvelope"] & {
            relinked: string[];
            replacement: string | null;
        };
        VocabularyTerm: {
            aliases: string | null;
            canonicalTermId?: string | null;
            /** Format: date-time */
            createdAt: string | null;
            id: string;
            /** @description Built-in or user-configured dictionary category key. */
            kind: string;
            note: string | null;
            term: string;
            /** Format: date-time */
            updatedAt: string | null;
        };
        VocabularyTermCreateRequest: {
            aliases?: string;
            canonicalTermId?: string | null;
            /** @description Built-in or user-configured dictionary category key. */
            kind?: string;
            note?: string;
            term: string;
        };
        VocabularyTermResponse: components["schemas"]["OkEnvelope"] & {
            term: components["schemas"]["VocabularyTerm"];
        };
        VocabularyTermsResponse: components["schemas"]["OkEnvelope"] & {
            preferredTermIds: string[];
            terms: components["schemas"]["VocabularyTerm"][];
        };
        WatchedIngestBatch: {
            entries: components["schemas"]["WatchedIngestEntry"][];
            id: string;
            /** @enum {string} */
            status: "pending" | "completed";
        };
        WatchedIngestBatchResponse: components["schemas"]["OkEnvelope"] & {
            batch: components["schemas"]["WatchedIngestBatch"];
        };
        WatchedIngestEntry: {
            checksum?: string | null;
            fileName: string;
            id: string;
            reason?: string | null;
            routing?: components["schemas"]["WatchedIngestRouting"];
            /** @enum {string} */
            status: "pending" | "applied" | "deferred" | "quarantined";
        };
        WatchedIngestRouting: {
            metadataTemplateId?: string | null;
            ruleId?: string;
            stagingDirectory?: string;
            tags?: string[];
        } | null;
        WatchedIngestRule: components["schemas"]["WatchedIngestRuleInput"] & {
            id: string;
        };
        WatchedIngestRuleInput: {
            enabled?: boolean;
            /** @enum {string} */
            matchType: "path_prefix" | "filename_pattern";
            metadataTemplateId?: string | null;
            pattern: string;
            stagingDirectory: string;
            tags?: string[];
        };
        WatchedIngestRuleResponse: components["schemas"]["OkEnvelope"] & {
            rule: components["schemas"]["WatchedIngestRule"];
        };
        WatchedIngestRulesResponse: components["schemas"]["OkEnvelope"] & {
            rules: components["schemas"]["WatchedIngestRule"][];
        };
        Webhook: {
            active: boolean;
            consecutiveFailures: number;
            /** Format: date-time */
            createdAt: string | null;
            events: components["schemas"]["WebhookEvent"][];
            id: string;
            /** Format: date-time */
            lastDeliveredAt?: string | null;
            name?: string | null;
            /** Format: uri */
            url: string;
        };
        WebhookCreateRequest: {
            events: components["schemas"]["WebhookEvent"][];
            name?: string;
            /**
             * Format: uri
             * @description Must be a public http(s) URL; loopback and private-range hosts are rejected
             */
            url: string;
        };
        WebhookCreateResponse: components["schemas"]["OkEnvelope"] & {
            /** @description Raw HMAC signing secret; only returned at creation time. Deliveries are signed as HMAC-SHA256(body, SHA256(secret)) in the X-Archive-Signature header */
            secret: string;
            webhook: components["schemas"]["Webhook"];
        };
        /** @enum {string} */
        WebhookEvent: "record.created" | "record.updated" | "record.deleted" | "media_job.completed" | "media_job.failed";
        WebhooksResponse: components["schemas"]["OkEnvelope"] & {
            webhooks: components["schemas"]["Webhook"][];
        };
    };
    responses: {
        /** @description Authenticated session */
        AuthSuccess: {
            headers: {
                /** @description HttpOnly refresh cookie when cookie auth is enabled */
                "Set-Cookie"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["AuthResponse"];
            };
        };
        /** @description Bulk macro not found or not owned by the current user */
        BulkMacroNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BulkMacroNotFoundError"];
            };
        };
        /** @description Preview confirmation or request validation error */
        BulkMacroRunError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BulkMacroPreviewError"] | components["schemas"]["BulkMacroValidationError"];
            };
        };
        /** @description Error response */
        Error: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description File write result */
        FileWriteSuccess: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["FileWriteResponse"];
            };
        };
        /** @description Success */
        Ok: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OkEnvelope"];
            };
        };
        /** @description Synthetic safety-preview error response */
        SafetyPreviewError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SafetyPreviewError"];
            };
        };
    };
    parameters: {
        FileKey: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    exportAccountData: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Account data export, scoped to the requesting user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountExportResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listActivity: {
        parameters: {
            query?: {
                event?: string;
                limit?: number;
                outcome?: "success" | "rejected" | "failed";
                page?: number;
                resourceId?: string;
                resourceType?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Audit-backed activity entries */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listApiKeys: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description API keys */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKeysResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    createApiKey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApiKeyCreateRequest"];
            };
        };
        responses: {
            /** @description Created API key; the raw token is only returned here */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKeyCreateResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteApiKey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listFileHealthChecks: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Health check history */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FileHealthChecksResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    runFileHealthCheck: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description New health check result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FileHealthCheckResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            200: components["responses"]["AuthSuccess"];
            401: components["responses"]["Error"];
            429: components["responses"]["Error"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"] & {
                        user: components["schemas"]["User"];
                    };
                };
            };
            401: components["responses"]["Error"];
        };
    };
    refreshSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["AuthSuccess"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            429: components["responses"]["Error"];
        };
    };
    listAutomationRules: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Automation rules and runs */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRulesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createAutomationRule: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAutomationRuleRequest"];
            };
        };
        responses: {
            /** @description Created automation rule */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRuleResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteAutomationRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateAutomationRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAutomationRuleRequest"];
            };
        };
        responses: {
            /** @description Updated automation rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRuleResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    runAutomationRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @default true */
                    dryRun?: boolean;
                };
            };
        };
        responses: {
            /** @description Automation rule run created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRuleRunResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listBulkMacros: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bulk macros */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacrosResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    createBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateBulkMacroRequest"];
            };
        };
        responses: {
            /** @description Created bulk macro */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bulk macro */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
        };
    };
    deleteBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted bulk macro */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroDeleteResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
        };
    };
    updateBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateBulkMacroRequest"];
            };
        };
        responses: {
            /** @description Updated bulk macro */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
            422: components["responses"]["Error"];
        };
    };
    previewBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkMacroTargetsRequest"];
            };
        };
        responses: {
            /** @description Signed non-mutating preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroPreviewResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
            422: components["responses"]["Error"];
        };
    };
    runBulkMacro: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RunBulkMacroRequest"];
            };
        };
        responses: {
            /** @description Persisted bulk macro run */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroRunResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
            422: components["responses"]["BulkMacroRunError"];
        };
    };
    listBulkMacroRuns: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bulk macro runs */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroRunsResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
        };
    };
    retryBulkMacroFailedTargets: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                runId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description New run containing only the retried targets */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkMacroRunResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["BulkMacroNotFound"];
        };
    };
    getCollaborationDocument: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                resourceId: string;
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Shared document draft */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationDocumentResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    updateCollaborationDocument: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                resourceId: string;
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollaborationDocumentUpdateRequest"];
            };
        };
        responses: {
            /** @description Shared document draft updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationDocumentResponse"];
                };
            };
            401: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listCollaborationLocks: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active resource locks */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationLocksResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    acquireCollaborationLock: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollaborationLockRequest"];
            };
        };
        responses: {
            /** @description Lock refreshed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationLockAcquireResponse"];
                };
            };
            /** @description Lock acquired */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationLockAcquireResponse"];
                };
            };
            401: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    releaseCollaborationLock: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollaborationLockReleaseRequest"];
            };
        };
        responses: {
            /** @description Lock release result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationLockReleaseResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listCollaborationPresence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Presence snapshot */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationPresenceResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    sendCollaborationHeartbeat: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roomKey: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["CollaborationHeartbeatRequest"];
            };
        };
        responses: {
            /** @description Presence snapshot after heartbeat */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollaborationPresenceResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listCollections: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Collections */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createCollection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionCreateRequest"];
            };
        };
        responses: {
            /** @description Created collection */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteCollection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateCollection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated collection */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listCollectionRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Member record ids */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionRecordsResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    addCollectionRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                recordId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    removeCollectionRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                recordId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listDepartmentFieldOwners: {
        parameters: {
            query: {
                departmentId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Field owners */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentFieldOwnersResponse"];
                };
            };
        };
    };
    replaceDepartmentFieldOwners: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentFieldOwnersRequest"];
            };
        };
        responses: {
            /** @description Field owners */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentFieldOwnersResponse"];
                };
            };
        };
    };
    listDepartmentQualityRules: {
        parameters: {
            query?: {
                departmentId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Quality rules */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentQualityRulesResponse"];
                };
            };
        };
    };
    upsertDepartmentQualityRule: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentQualityRuleInput"];
            };
        };
        responses: {
            /** @description Quality rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentQualityRuleResponse"];
                };
            };
            /** @description Created quality rule */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentQualityRuleResponse"];
                };
            };
        };
    };
    previewDepartmentQuality: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentQualityPreviewRequest"];
            };
        };
        responses: {
            /** @description Readiness result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentQualityPreviewResponse"];
                };
            };
        };
    };
    getDepartmentTemplateMetrics: {
        parameters: {
            query: {
                departmentId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Aggregate metrics */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentTemplateMetricsResponse"];
                };
            };
        };
    };
    discoverRecords: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Discovery sections */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DiscoverResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listFavorites: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved favorites */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FavoritesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createFavorite: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FavoriteCreateRequest"];
            };
        };
        responses: {
            /** @description Saved favorite */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FavoriteResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    deleteFavorite: {
        parameters: {
            query?: {
                store?: string;
            };
            header?: never;
            path: {
                recordId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listOpenFieldRequests: {
        parameters: {
            query?: {
                assignee?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Open field requests */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFieldRequestsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    deleteFieldRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    resolveFieldRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resolved request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFieldRequestResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listFiles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Files */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FileListResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    getFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: components["parameters"]["FileKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Binary file stream */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    putFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: components["parameters"]["FileKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/octet-stream": string;
            };
        };
        responses: {
            200: components["responses"]["FileWriteSuccess"];
            201: components["responses"]["FileWriteSuccess"];
            401: components["responses"]["Error"];
        };
    };
    deleteFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: components["parameters"]["FileKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    browseFiles: {
        parameters: {
            query?: {
                path?: string;
                query?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Directory listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FileBrowserResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listUnusedFiles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Unused file candidates */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnusedFilesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listFolders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Folders */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FolderListResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Health information */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    previewImportUrl: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportPreviewRequest"];
            };
        };
        responses: {
            /** @description Import preview metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportPreviewResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listInboxItems: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Inbox items */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InboxItemsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createInboxItem: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InboxItemCreateRequest"];
            };
        };
        responses: {
            /** @description Created inbox item */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InboxItemResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteInboxItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateInboxItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InboxItemUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated inbox item */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InboxItemResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    routeInboxDepartment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentRoutingRequest"];
            };
        };
        responses: {
            /** @description Routed inbox item */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentRoutingPreview"];
                };
            };
        };
    };
    previewInboxDepartmentRouting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentRoutingRequest"];
            };
        };
        responses: {
            /** @description Routing preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentRoutingPreview"];
                };
            };
        };
    };
    dropboxPullIngest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dropbox pull and ingest result. Large files download in resumable Range-request chunks; no request body is needed, unlike ftp/smb pull, since the authenticated user's stored connection supplies the source. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestScanResponse"];
                };
            };
            401: components["responses"]["Error"];
            409: components["responses"]["Error"];
        };
    };
    ftpPullIngest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FtpPullRequest"];
            };
        };
        responses: {
            /** @description FTP pull and ingest result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestScanResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    scanIngest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ingest scan result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestScanResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    smbPullIngest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SmbPullRequest"];
            };
        };
        responses: {
            /** @description SMB pull and ingest result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestScanResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    applyWatchedIngestBatch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batchId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Completed watched ingest batch */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchedIngestBatchResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listWatchedIngestRules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Rules */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchedIngestRulesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createWatchedIngestRule: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WatchedIngestRuleInput"];
            };
        };
        responses: {
            /** @description Created rule */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchedIngestRuleResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteWatchedIngestRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    updateWatchedIngestRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WatchedIngestRuleInput"];
            };
        };
        responses: {
            /** @description Updated rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchedIngestRuleResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    previewWatchedIngest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Watched ingest preview batch */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchedIngestBatchResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listIntakeTemplates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Intake templates */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntakeTemplatesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createIntakeTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IntakeTemplateCreateRequest"];
            };
        };
        responses: {
            /** @description Created template */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntakeTemplateResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteIntakeTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    verifyDropboxWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dropbox challenge */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    receiveDropboxWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Accepted or duplicate event */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Error"];
        };
    };
    acceptInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AcceptInvitationRequest"];
            };
        };
        responses: {
            /** @description Created user account */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAccountResponse"];
                };
            };
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listBrokenLinks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Broken relation links */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkAuditResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createReviewLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                mediaUid: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["CreateReviewLinkRequest"];
            };
        };
        responses: {
            /** @description Review link created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateReviewLinkResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listMediaWorkflows: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
                recordId?: string;
                status?: "queued" | "processing" | "completed" | "failed";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of media workflows */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"] & {
                        jobs: components["schemas"]["MediaJob"][];
                        pagination?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            401: components["responses"]["Error"];
        };
    };
    queueMediaWorkflow: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MediaJobRequest"];
            };
        };
        responses: {
            /** @description Media workflow queued */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaJobResponse"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
        };
    };
    getMediaWorkflow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Media workflow status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaJobResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listMetadataTemplates: {
        parameters: {
            query?: {
                departmentId?: string;
                includeDisabled?: boolean;
                typeId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Metadata templates */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplatesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createMetadataTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MetadataTemplateCreateRequest"];
            };
        };
        responses: {
            /** @description Created template */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplateResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteMetadataTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateMetadataTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MetadataTemplateUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplateResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    publishMetadataTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Published template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplateResponse"];
                };
            };
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    restorePublishedMetadataTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Restored published template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplateResponse"];
                };
            };
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listMetadataTemplateVersions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Template versions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetadataTemplateVersionsResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listMontageProjects: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
                status?: "draft" | "finalized" | "archived";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Montage projects for the requested status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MontageProjectsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createMontageProject: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMontageProjectRequest"];
            };
        };
        responses: {
            /** @description Created montage project */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MontageProjectResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getMontageProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Montage project */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MontageProjectResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateMontageProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMontageProjectRequest"];
            };
        };
        responses: {
            /** @description Updated montage project */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MontageProjectResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteMontageProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listNamingRules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Naming rules */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NamingRulesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    upsertNamingRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NamingRuleUpsertRequest"];
            };
        };
        responses: {
            /** @description Saved naming rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NamingRuleResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteNamingRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    getOnboardingProgress: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Shared onboarding progress */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingProgressResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    updateOnboardingStage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                stage: components["schemas"]["OnboardingStageId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOnboardingStageRequest"];
            };
        };
        responses: {
            /** @description Updated shared onboarding progress */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingProgressResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listPlugins: {
        parameters: {
            query?: {
                category?: "metadata" | "workflow" | "ai" | "integration";
                status?: "reviewed" | "draft" | "blocked";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Plugin catalog and permission review model */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PluginCatalogResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listProjectTasks: {
        parameters: {
            query?: {
                projectId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project tasks */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectTasksResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createProjectTask: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectTaskCreateRequest"];
            };
        };
        responses: {
            /** @description Created task */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectTaskResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    updateProjectTask: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectTaskUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated task */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectTaskResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listProjects: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Projects */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createProject: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectCreateRequest"];
            };
        };
        responses: {
            /** @description Created project */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated project */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listProjectRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Linked record ids */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRecordsResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    linkProjectRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                recordId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    unlinkProjectRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                recordId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
        };
    };
    reorderProjectRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectRecordOrderRequest"];
            };
        };
        responses: {
            /** @description Ordered project records */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRecordsResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getPublicCatalog: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                q?: string;
                tag?: string;
                type?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Published public catalog records */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicCatalogResponse"];
                };
            };
            422: components["responses"]["Error"];
        };
    };
    deleteRecordComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    deleteRecordNote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateRecordNote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordNoteUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated note */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordNoteResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteRecordSegment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateRecordSegment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordSegmentUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated segment */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSegmentResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecords: {
        parameters: {
            query: {
                cursor?: string;
                limit?: number;
                store: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Record page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordListResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createRecord: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordCreateRequest"];
            };
        };
        responses: {
            /** @description Created record */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"] & {
                        record: components["schemas"]["ArchiveRecord"];
                    };
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getRecord: {
        parameters: {
            query?: {
                store?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"] & {
                        record: components["schemas"]["ArchiveRecord"];
                    };
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    recordAiAssist: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Review-required assistance draft */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordAiAssistResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordAttachments: {
        parameters: {
            query?: {
                store?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordAttachmentsResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    uploadRecordAttachments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    files: string[];
                    store?: string;
                };
            };
        };
        responses: {
            /** @description Created attachments */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordAttachmentsResponse"];
                };
            };
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteRecordAttachment: {
        parameters: {
            query?: {
                store?: string;
            };
            header?: never;
            path: {
                attachmentId: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    getRecordBroadcastMetadata: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Broadcast metadata, or configuration-required state when no MOS/MXF integration is configured */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordBroadcastMetadataResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    putRecordBroadcastMetadata: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordBroadcastMetadataRequest"];
            };
        };
        responses: {
            /** @description Updated broadcast metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordBroadcastMetadataResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
        };
    };
    previewRecordChangeImpact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    operation: "update" | "delete";
                };
            };
        };
        responses: {
            /** @description Change impact */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordChangeImpactResponse"];
                };
            };
        };
    };
    listRecordComments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Record comments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordCommentsResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    createRecordComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordCommentCreateRequest"];
            };
        };
        responses: {
            /** @description Created comment */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordCommentResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    createDepartmentHandoff: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentHandoffRequest"];
            };
        };
        responses: {
            /** @description Handoff */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DepartmentHandoffResponse"];
                };
            };
        };
    };
    getRecordEditClaim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Edit claim or null */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordEditClaimResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    claimRecordEdit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active claim */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordEditClaimResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    releaseRecordEditClaim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
        };
    };
    listRecordFieldRequests: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Field requests */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFieldRequestsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createRecordFieldRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordFieldRequestCreateRequest"];
            };
        };
        responses: {
            /** @description Created request */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFieldRequestResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordFieldSources: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Field sources */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFieldSourcesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    getRecordFreeze: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Freeze status or null */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFreezeResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    freezeRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordFreezeRequest"];
            };
        };
        responses: {
            /** @description Freeze applied */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordFreezeResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    unfreezeRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listRecordHistory: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Record history entries */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordHistoryResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    mergeRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordMergeRequest"];
            };
        };
        responses: {
            /** @description Merge result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordMergeResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    previewRecordMerge: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordMergeRequest"];
            };
        };
        responses: {
            /** @description Merge preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordMergePreviewResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordNotes: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Record notes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordNotesResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    createRecordNote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordNoteCreateRequest"];
            };
        };
        responses: {
            /** @description Created note */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordNoteResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordProjects: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Projects containing this record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordProjectsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listRecordSegments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Segments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSegmentsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createRecordSegment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordSegmentCreateRequest"];
            };
        };
        responses: {
            /** @description Created segment */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSegmentResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordSnapshots: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Snapshots */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSnapshotsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    diffRecordSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                snapshotId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Field-level diff */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSnapshotDiffResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    restoreRecordSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                snapshotId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["RecordSnapshotRestoreRequest"];
            };
        };
        responses: {
            /** @description Restored fields */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSnapshotRestoreResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    replaceRecordSource: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Replaced record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordResponse"];
                };
            };
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listRecordSourceVersions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Source versions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordSourceVersionsResponse"];
                };
            };
        };
    };
    restoreRecordSource: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                versionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Restored record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    updateRecordTranscript: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    store?: string;
                    transcript: string;
                };
            };
        };
        responses: {
            /** @description Updated record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"] & {
                        record: components["schemas"]["ArchiveRecord"];
                    };
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    saveRecordSubtitles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubtitleContentUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    importRecordSubtitles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /**
                     * Format: binary
                     * @description SRT or WebVTT subtitle file.
                     */
                    file: string;
                    store?: string;
                };
            };
        };
        responses: {
            /** @description Updated record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getRecordTriageFlag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Triage flag or null */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordTriageFlagResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    setRecordTriageFlag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordTriageFlagUpsertRequest"];
            };
        };
        responses: {
            /** @description Saved flag */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordTriageFlagResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    clearRecordTriageFlag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    bulkUpsertRecords: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkRecordsRequest"];
            };
        };
        responses: {
            200: components["responses"]["Ok"];
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
        };
    };
    bulkDeleteRecords: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkDeleteRecordsRequest"];
            };
        };
        responses: {
            /** @description Per-item delete results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkDeleteRecordsResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    exportRecordsCsv: {
        parameters: {
            query: {
                store: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV export (uid,title,description,type,subtype,status,tags) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    importRecordsCsv: {
        parameters: {
            query: {
                dryRun?: boolean;
                store: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Per-row import result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordsImportCsvResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    createRecordRelation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRecordRelationRequest"];
            };
        };
        responses: {
            /** @description Existing relation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordRelationResponse"];
                };
            };
            /** @description Created relation */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordRelationResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteRecordRelation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateRecordRelation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRecordRelationRequest"];
            };
        };
        responses: {
            /** @description Updated relation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordRelationResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    relationGraph: {
        parameters: {
            query?: {
                limit?: number;
                recordId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Relation graph */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RelationGraphResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    getComplianceReport: {
        parameters: {
            query?: {
                event?: string;
                from?: string;
                limit?: number;
                outcome?: "success" | "rejected" | "failed";
                resourceType?: string;
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Operational compliance evidence and summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ComplianceReportResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    exportComplianceReport: {
        parameters: {
            query?: {
                event?: string;
                from?: string;
                outcome?: "success" | "rejected" | "failed";
                resourceType?: string;
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV attachment */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getReviewLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Review link payload */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewLinkPayloadResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    getRightsByItem: {
        parameters: {
            query: {
                itemId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Rights record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    upsertRights: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RightsRecordInput"];
            };
        };
        responses: {
            /** @description Rights record saved */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordResponse"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
        };
    };
    getRightsEnforcement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                itemId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Enforcement summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsEnforcementResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listExpiringRights: {
        parameters: {
            query?: {
                days?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Expiring rights */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordListResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    runSafetyPreview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SafetyPreviewRunRequest"];
            };
        };
        responses: {
            /** @description Synthetic preview result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SafetyPreviewRunResponse"];
                };
            };
            401: components["responses"]["SafetyPreviewError"];
            403: components["responses"]["SafetyPreviewError"];
            422: components["responses"]["SafetyPreviewError"];
        };
    };
    safetyPreviewScenarios: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Synthetic scenario identifiers */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SafetyPreviewScenariosResponse"];
                };
            };
            401: components["responses"]["SafetyPreviewError"];
            403: components["responses"]["SafetyPreviewError"];
        };
    };
    listSavedSearches: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved searches */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedSearchesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createSavedSearch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SavedSearchCreateRequest"];
            };
        };
        responses: {
            /** @description Created saved search */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedSearchResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteSavedSearch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    replaceSavedSearchAccess: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SavedSearchAccessRequest"];
            };
        };
        responses: {
            /** @description Updated saved search */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedSearchResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    copySavedSearch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Private saved-search copy */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SavedSearchResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    searchRecords: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description Include records dated on or after this archive/event date. */
                dateFrom?: string;
                /** @description Include records dated on or before this archive/event date. */
                dateTo?: string;
                /** @description Filter by descriptor completeness. */
                descriptionState?: "complete" | "incomplete";
                limit?: number;
                /** @description Explicit search mode. transcript returns only matches from time-coded VTT/SRT cues; semantic falls back to keyword when embeddings are unavailable. */
                mode?: "keyword" | "semantic" | "transcript";
                /** @description Free-text search, or an advanced field query. Supported fields: title, description, type, subtype, tag, store, status, uid. Clauses use field:value (quoted values may contain spaces), with NOT, AND (including implicit whitespace AND), then OR precedence. Parentheses are unsupported. Invalid advanced syntax returns 422. */
                q?: string;
                semantic?: boolean;
                status?: string;
                store?: string;
                subtype?: string;
                tag?: string;
                type?: string;
                workflowStatus?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Search result page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    searchSuggestions: {
        parameters: {
            query: {
                limit?: number;
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suggestions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchSuggestionsResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    createShare: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateShareRequest"];
            };
        };
        responses: {
            /** @description Share created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateShareResponse"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
        };
    };
    getShare: {
        parameters: {
            query?: never;
            header?: {
                /** @description Password for password-protected share links. Preferred over the deprecated `password` query parameter, which is accepted only as a fallback and will be removed in v1.1. */
                "X-Share-Password"?: string;
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Share payload */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SharePayloadResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    revokeShare: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listSuggestions: {
        parameters: {
            query: {
                context: components["schemas"]["SuggestionContext"];
                /** @description Required when context is detail */
                recordId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suggestions available to the current user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuggestionsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    submitSuggestionFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SuggestionFeedbackRequest"];
            };
        };
        responses: {
            /** @description Persisted suggestion feedback */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuggestionFeedbackResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listSyncLog: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sync log entries */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncLogResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listBackups: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Available backups, newest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupListResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    previewBackup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BackupNameRequest"];
            };
        };
        responses: {
            /** @description Backup summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupPreviewResponse"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    restoreBackup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BackupNameRequest"];
            };
        };
        responses: {
            /** @description Restore result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupRestoreResponse"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    runBackup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Backup created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupRunResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            500: components["responses"]["Error"];
        };
    };
    runSystemControlAction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                action: "clear-cache" | "run-backup";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Action result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemControlResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
            503: components["responses"]["Error"];
        };
    };
    systemDrProbe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description DR readiness probe */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DrProbeResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    getDropboxConnection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dropbox connection state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DropboxConnectionResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    disconnectDropbox: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disconnected */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DropboxConnectionResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    authorizeDropbox: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authorization URL */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DropboxAuthorizationResponse"];
                };
            };
            409: components["responses"]["Error"];
        };
    };
    connectDropbox: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DropboxConnectRequest"];
            };
        };
        responses: {
            /** @description Connected */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DropboxConnectionResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    syncDropbox: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dropbox folder delta */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DropboxSyncResponse"];
                };
            };
            409: components["responses"]["Error"];
            502: components["responses"]["Error"];
        };
    };
    systemMetricsHistory: {
        parameters: {
            query?: {
                /** @description Window in days. Clamped to 1..365 — an unbounded window would let one request scan the whole history. */
                days?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Storage samples, oldest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemMetricsHistoryResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    getOdbcStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ODBC readiness summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OdbcStatusResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    getOdbcTablePreview: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path: {
                table: "items" | "users" | "settings" | "audit";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ODBC table preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OdbcTablePreviewResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    createOdbcTableRow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                table: "items" | "users" | "settings" | "audit";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OdbcRowWriteRequest"];
            };
        };
        responses: {
            /** @description ODBC row inserted */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OdbcWriteResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteOdbcTableRow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                table: "items" | "users" | "settings" | "audit";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OdbcRowKeyRequest"];
            };
        };
        responses: {
            /** @description ODBC row deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OdbcWriteResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    updateOdbcTableRow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                table: "items" | "users" | "settings" | "audit";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OdbcRowKeyRequest"] & components["schemas"]["OdbcRowWriteRequest"];
            };
        };
        responses: {
            /** @description ODBC row updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OdbcWriteResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getSecuritySettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current security settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SecuritySettingsResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    updateSecuritySettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSecuritySettingsRequest"];
            };
        };
        responses: {
            /** @description Updated security settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SecuritySettingsResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    systemStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Host metrics and DR readiness */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemStatusResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    startStorageOperation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Queued operation */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageOperationResponse"];
                };
            };
        };
    };
    getStorageOperation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                operation: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageOperationResponse"];
                };
            };
        };
    };
    cancelStorageOperation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                operation: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageOperationResponse"];
                };
            };
        };
    };
    previewStorageOperation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StorageOperationPreviewRequest"];
            };
        };
        responses: {
            /** @description Signed preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageOperationPreviewResponse"];
                };
            };
            422: components["responses"]["Error"];
        };
    };
    listStorageWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Storage catalog */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageCatalogResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    browseStorageWorkspace: {
        parameters: {
            query?: {
                path?: string;
            };
            header?: never;
            path: {
                storage: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Folder contents */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageBrowseResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    listTagNodes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tag nodes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagNodesResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createTagNode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TagNodeCreateRequest"];
            };
        };
        responses: {
            /** @description Created tag node */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagNodeResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteTagNode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    updateTagNode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TagNodeUpdateRequest"];
            };
        };
        responses: {
            /** @description Updated tag node */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagNodeResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listTrash: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
                /** @description Case-insensitive substring match against the uid and the raw JSON payload. */
                q?: string;
                /** @description Restrict to one store. Omit to list every store. */
                store?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated trash entries, newest deletion first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrashListResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    purgeTrash: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TrashTargetsRequest"];
            };
        };
        responses: {
            /** @description Per-item purge results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrashPurgeResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    restoreTrash: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TrashTargetsRequest"];
            };
        };
        responses: {
            /** @description Per-item restore results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrashRestoreResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listTypes: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Type definitions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        nextCursor: string | null;
                        /** @constant */
                        ok: true;
                        types: components["schemas"]["TypeDefinition"][];
                    };
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    storeType: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TypeDefinition"];
            };
        };
        responses: {
            /** @description Updated type definition */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TypeResponse"];
                };
            };
            /** @description Created type definition */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TypeResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getType: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Type definition */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TypeResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    deleteType: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    listUploadLinks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Upload links */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadLinksResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createUploadLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadLinkCreateRequest"];
            };
        };
        responses: {
            /** @description Created upload link */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadLinkResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    revokeUploadLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked upload link */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadLinkResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    getUploadLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Upload link is active */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadLinkResponse"];
                };
            };
            404: components["responses"]["Error"];
        };
    };
    uploadFile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadRequest"];
            };
        };
        responses: {
            /** @description File uploaded and archive record created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listScheduledUploads: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Scheduled uploads page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadListResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    createScheduledUpload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateScheduledUploadRequest"];
            };
        };
        responses: {
            /** @description Existing schedule returned for a duplicate idempotency key */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadCreateResponse"];
                };
            };
            /** @description Scheduled upload created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadCreateResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    getScheduledUpload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Scheduled upload */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    cancelScheduledUpload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Scheduled upload cancelled */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
        };
    };
    rescheduleScheduledUpload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RescheduleUploadRequest"];
            };
        };
        responses: {
            /** @description Scheduled upload rescheduled */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    retryScheduledUpload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Scheduled upload requeued */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduledUploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
        };
    };
    createUploadSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateUploadSessionRequest"];
            };
        };
        responses: {
            /** @description Upload session created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadSessionResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
            507: components["responses"]["Error"];
        };
    };
    getUploadSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Upload session state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadSessionResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    abortUploadSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Upload session aborted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OkEnvelope"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    uploadSessionChunk: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                index: number;
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/octet-stream": string;
            };
        };
        responses: {
            /** @description Chunk accepted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadChunkResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            410: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    completeUploadSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description File assembled and archive record created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            410: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listUsers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Users and pending invitations */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsersListResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    inviteUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteUserRequest"];
            };
        };
        responses: {
            /** @description Invitation created; the one-time token is only returned here */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InviteUserResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    updateUserRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserRoleRequest"];
            };
        };
        responses: {
            /** @description Updated user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAccountResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listMentionableUsers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Minimal user directory (id and name only) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MentionableUsersResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    listVocabularyTerms: {
        parameters: {
            query?: {
                /** @description Prioritize the current user's approved terms for this department. */
                departmentId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Vocabulary terms */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    createVocabularyTerm: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VocabularyTermCreateRequest"];
            };
        };
        responses: {
            /** @description Created vocabulary term */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermResponse"];
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteVocabularyTerm: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    relinkVocabularyTerm: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VocabularyRelinkRequest"];
            };
        };
        responses: {
            /** @description Relink result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyRelinkResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    previewVocabularyRelink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Affected records */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyRelinkPreviewResponse"];
                };
            };
            401: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
    replaceDepartmentVocabularyPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DepartmentVocabularyPreferencesRequest"];
            };
        };
        responses: {
            /** @description Vocabulary terms with the department preferences applied */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermsResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    exportVocabularyTerms: {
        parameters: {
            query?: {
                format?: "csv" | "json";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Vocabulary export */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermsResponse"];
                    "text/csv": string;
                };
            };
            401: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    importVocabularyTerms: {
        parameters: {
            query: {
                dryRun?: boolean;
                format: "csv" | "json";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Import result (or diff, when dryRun=1) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyImportResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listVocabularyKinds: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Vocabulary categories */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyKindsResponse"];
                };
            };
            401: components["responses"]["Error"];
        };
    };
    replaceVocabularyKinds: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VocabularyKindsReplaceRequest"];
            };
        };
        responses: {
            /** @description Vocabulary categories */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyKindsResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    listWebhooks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook subscriptions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhooksResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WebhookCreateRequest"];
            };
        };
        responses: {
            /** @description Created webhook subscription; the raw signing secret is only returned here */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookCreateResponse"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            422: components["responses"]["Error"];
        };
    };
    deleteWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Ok"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
        };
    };
}

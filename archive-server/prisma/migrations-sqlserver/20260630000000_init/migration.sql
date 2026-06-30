BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[storage_rows] (
    [store] NVARCHAR(1000) NOT NULL,
    [uid] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL,
    [syncVersion] INT,
    [lastModifiedBy] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [storage_rows_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [embedding] NVARCHAR(max),
    CONSTRAINT [storage_rows_pkey] PRIMARY KEY CLUSTERED ([store],[uid])
);

-- CreateTable
CREATE TABLE [dbo].[share_revocations] (
    [jti] NVARCHAR(1000) NOT NULL,
    [revokedAt] DATETIME2 NOT NULL CONSTRAINT [share_revocations_revokedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [share_revocations_pkey] PRIMARY KEY CLUSTERED ([jti])
);

-- CreateTable
CREATE TABLE [dbo].[typed_users] (
    [id] NVARCHAR(1000) NOT NULL,
    [username] NVARCHAR(1000) NOT NULL,
    [displayName] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [typed_users_role_df] DEFAULT 'viewer',
    [isActive] BIT NOT NULL CONSTRAINT [typed_users_isActive_df] DEFAULT 1,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [totpSecret] NVARCHAR(1000),
    [totpEnabled] BIT NOT NULL CONSTRAINT [typed_users_totpEnabled_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [typed_users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [typed_users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [typed_users_username_key] UNIQUE NONCLUSTERED ([username]),
    CONSTRAINT [typed_users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[typed_archive_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [store] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [documentType] NVARCHAR(1000),
    [mimeType] NVARCHAR(1000),
    [fileKey] NVARCHAR(1000),
    [fileSizeBytes] BIGINT,
    [pageCount] INT,
    [tags] NVARCHAR(max) NOT NULL CONSTRAINT [typed_archive_items_tags_df] DEFAULT '[]',
    [categoryId] NVARCHAR(1000),
    [ocrText] NVARCHAR(1000),
    [summary] NVARCHAR(1000),
    [isDeleted] BIT NOT NULL CONSTRAINT [typed_archive_items_isDeleted_df] DEFAULT 0,
    [deletedAt] DATETIME2,
    [archived_at] DATETIME2,
    [syncVersion] INT NOT NULL CONSTRAINT [typed_archive_items_syncVersion_df] DEFAULT 0,
    [ownerId] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [typed_archive_items_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [typed_archive_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[record_versions] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [store] NVARCHAR(1000) NOT NULL,
    [record_uid] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL CONSTRAINT [record_versions_version_df] DEFAULT 1,
    [snapshot] NVARCHAR(max) NOT NULL,
    [user_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [record_versions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [record_versions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[typed_content_types] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [icon] NVARCHAR(1000),
    [color] NVARCHAR(1000),
    [isBuiltIn] BIT NOT NULL CONSTRAINT [typed_content_types_isBuiltIn_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [typed_content_types_isActive_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [typed_content_types_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [typed_content_types_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [typed_content_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [typed_content_types_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[saved_filters] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [query] NVARCHAR(max) NOT NULL,
    [is_live] BIT NOT NULL CONSTRAINT [saved_filters_is_live_df] DEFAULT 0,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [saved_filters_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [saved_filters_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[webhooks] (
    [id] NVARCHAR(1000) NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [events] NVARCHAR(max) NOT NULL CONSTRAINT [webhooks_events_df] DEFAULT '[]',
    [secret] NVARCHAR(1000) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [webhooks_active_df] DEFAULT 1,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [webhooks_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [webhooks_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification_preferences] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [email_on_share] BIT NOT NULL CONSTRAINT [notification_preferences_email_on_share_df] DEFAULT 1,
    [email_on_upload] BIT NOT NULL CONSTRAINT [notification_preferences_email_on_upload_df] DEFAULT 0,
    [email_on_mention] BIT NOT NULL CONSTRAINT [notification_preferences_email_on_mention_df] DEFAULT 1,
    [push_on_share] BIT NOT NULL CONSTRAINT [notification_preferences_push_on_share_df] DEFAULT 1,
    [push_on_upload] BIT NOT NULL CONSTRAINT [notification_preferences_push_on_upload_df] DEFAULT 1,
    [push_on_mention] BIT NOT NULL CONSTRAINT [notification_preferences_push_on_mention_df] DEFAULT 1,
    [push_on_system] BIT NOT NULL CONSTRAINT [notification_preferences_push_on_system_df] DEFAULT 1,
    CONSTRAINT [notification_preferences_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_preferences_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[api_keys] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [key_hash] NVARCHAR(1000) NOT NULL,
    [prefix] NVARCHAR(1000) NOT NULL,
    [scopes] NVARCHAR(max) NOT NULL CONSTRAINT [api_keys_scopes_df] DEFAULT '[]',
    [owner_id] NVARCHAR(1000) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [api_keys_active_df] DEFAULT 1,
    [last_used_at] DATETIME2,
    [expires_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [api_keys_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [api_keys_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [api_keys_key_hash_key] UNIQUE NONCLUSTERED ([key_hash])
);

-- CreateTable
CREATE TABLE [dbo].[push_subscriptions] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [endpoint] NVARCHAR(1000) NOT NULL,
    [p256dh] NVARCHAR(1000) NOT NULL,
    [auth] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [push_subscriptions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [push_subscriptions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [push_subscriptions_endpoint_key] UNIQUE NONCLUSTERED ([endpoint])
);

-- CreateTable
CREATE TABLE [dbo].[activity_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [activity_log_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [user_id] NVARCHAR(1000) NOT NULL,
    [user_name] NVARCHAR(1000) NOT NULL,
    [user_role] NVARCHAR(1000),
    [session_id] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [target_type] NVARCHAR(1000) NOT NULL,
    [target_id] NVARCHAR(1000),
    [target_name] NVARCHAR(1000) NOT NULL CONSTRAINT [activity_log_target_name_df] DEFAULT '',
    [before] NVARCHAR(max),
    [after] NVARCHAR(max),
    [diff] NVARCHAR(max),
    [related_ids] NVARCHAR(max),
    [undoable] BIT NOT NULL CONSTRAINT [activity_log_undoable_df] DEFAULT 0,
    [undone] BIT NOT NULL CONSTRAINT [activity_log_undone_df] DEFAULT 0,
    [undone_by] NVARCHAR(1000),
    [undone_at] DATETIME2,
    [context] NVARCHAR(max),
    CONSTRAINT [activity_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[derived_files] (
    [id] NVARCHAR(1000) NOT NULL,
    [source_item_id] NVARCHAR(1000),
    [source_key] NVARCHAR(1000) NOT NULL,
    [output_key] NVARCHAR(1000),
    [conversion_type] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL CONSTRAINT [derived_files_label_df] DEFAULT '',
    [mime_type] NVARCHAR(1000),
    [file_size_bytes] BIGINT,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [derived_files_status_df] DEFAULT 'pending',
    [job_id] NVARCHAR(1000),
    [error_message] NVARCHAR(1000),
    [created_by] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [derived_files_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [completed_at] DATETIME2,
    CONSTRAINT [derived_files_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[share_invitations] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL CONSTRAINT [share_invitations_title_df] DEFAULT '',
    [message] NVARCHAR(1000) NOT NULL CONSTRAINT [share_invitations_message_df] DEFAULT '',
    [scope] NVARCHAR(max) NOT NULL,
    [permission] NVARCHAR(1000) NOT NULL CONSTRAINT [share_invitations_permission_df] DEFAULT 'view',
    [share_jti] NVARCHAR(1000),
    [share_path] NVARCHAR(1000) NOT NULL,
    [share_url] NVARCHAR(1000) NOT NULL,
    [password_protected] BIT NOT NULL CONSTRAINT [share_invitations_password_protected_df] DEFAULT 0,
    [expires_at] DATETIME2,
    [invited_by_user_id] NVARCHAR(1000),
    [invited_by_username] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [share_invitations_status_df] DEFAULT 'created',
    [email_sent_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [share_invitations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [share_invitations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[share_comments] (
    [id] NVARCHAR(1000) NOT NULL,
    [item_id] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(1000) NOT NULL,
    [author_name] NVARCHAR(1000) NOT NULL,
    [author_type] NVARCHAR(1000) NOT NULL CONSTRAINT [share_comments_author_type_df] DEFAULT 'share_link',
    [share_jti] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [share_comments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [share_comments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[rights_records] (
    [id] NVARCHAR(1000) NOT NULL,
    [item_id] NVARCHAR(1000) NOT NULL,
    [rights_holder] NVARCHAR(1000) NOT NULL,
    [license_type] NVARCHAR(1000) NOT NULL,
    [embargo_start] DATETIME2,
    [embargo_end] DATETIME2,
    [expires_at] DATETIME2,
    [geo_restrictions] NVARCHAR(max) NOT NULL CONSTRAINT [rights_records_geo_restrictions_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [rights_records_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [rights_records_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [rights_records_item_id_key] UNIQUE NONCLUSTERED ([item_id])
);

-- CreateTable
CREATE TABLE [dbo].[item_relations] (
    [id] NVARCHAR(1000) NOT NULL,
    [source_id] NVARCHAR(1000) NOT NULL,
    [target_id] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [item_relations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_by] NVARCHAR(1000),
    [note] NVARCHAR(1000),
    CONSTRAINT [item_relations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [item_relations_source_id_target_id_type_key] UNIQUE NONCLUSTERED ([source_id],[target_id],[type])
);

-- CreateTable
CREATE TABLE [dbo].[retention_rules] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [scope] NVARCHAR(1000) NOT NULL CONSTRAINT [retention_rules_scope_df] DEFAULT 'all',
    [lifetime_days] INT NOT NULL,
    [action] NVARCHAR(1000) NOT NULL CONSTRAINT [retention_rules_action_df] DEFAULT 'archive',
    [active] BIT NOT NULL CONSTRAINT [retention_rules_active_df] DEFAULT 1,
    [created_by] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [retention_rules_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [retention_rules_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [storage_rows_store_idx] ON [dbo].[storage_rows]([store]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [storage_rows_createdAt_idx] ON [dbo].[storage_rows]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [storage_rows_syncVersion_idx] ON [dbo].[storage_rows]([syncVersion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_users_role_idx] ON [dbo].[typed_users]([role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_users_isActive_idx] ON [dbo].[typed_users]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_store_idx] ON [dbo].[typed_archive_items]([store]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_isDeleted_idx] ON [dbo].[typed_archive_items]([isDeleted]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_createdAt_idx] ON [dbo].[typed_archive_items]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_store_isDeleted_idx] ON [dbo].[typed_archive_items]([store], [isDeleted]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_categoryId_idx] ON [dbo].[typed_archive_items]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_archive_items_archived_at_idx] ON [dbo].[typed_archive_items]([archived_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [record_versions_store_record_uid_idx] ON [dbo].[record_versions]([store], [record_uid]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [typed_content_types_isActive_idx] ON [dbo].[typed_content_types]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [saved_filters_owner_id_idx] ON [dbo].[saved_filters]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [webhooks_owner_id_idx] ON [dbo].[webhooks]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [api_keys_owner_id_idx] ON [dbo].[api_keys]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [push_subscriptions_user_id_idx] ON [dbo].[push_subscriptions]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_log_timestamp_idx] ON [dbo].[activity_log]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_log_user_id_idx] ON [dbo].[activity_log]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_log_target_type_idx] ON [dbo].[activity_log]([target_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_log_action_idx] ON [dbo].[activity_log]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_log_target_id_idx] ON [dbo].[activity_log]([target_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [derived_files_source_item_id_idx] ON [dbo].[derived_files]([source_item_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [derived_files_source_key_idx] ON [dbo].[derived_files]([source_key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [derived_files_status_idx] ON [dbo].[derived_files]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [derived_files_job_id_idx] ON [dbo].[derived_files]([job_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [share_invitations_email_idx] ON [dbo].[share_invitations]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [share_invitations_share_jti_idx] ON [dbo].[share_invitations]([share_jti]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [share_invitations_status_idx] ON [dbo].[share_invitations]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [share_comments_item_id_idx] ON [dbo].[share_comments]([item_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [share_comments_share_jti_idx] ON [dbo].[share_comments]([share_jti]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [rights_records_item_id_idx] ON [dbo].[rights_records]([item_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [rights_records_expires_at_idx] ON [dbo].[rights_records]([expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [rights_records_license_type_idx] ON [dbo].[rights_records]([license_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [item_relations_source_id_idx] ON [dbo].[item_relations]([source_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [item_relations_target_id_idx] ON [dbo].[item_relations]([target_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [retention_rules_active_idx] ON [dbo].[retention_rules]([active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [retention_rules_scope_idx] ON [dbo].[retention_rules]([scope]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

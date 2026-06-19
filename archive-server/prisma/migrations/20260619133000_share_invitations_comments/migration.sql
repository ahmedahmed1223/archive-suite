-- §16.7 — persistent share invitations and share-link comments.

CREATE TABLE IF NOT EXISTS "share_invitations" (
    "id"                   TEXT         NOT NULL,
    "email"                TEXT         NOT NULL,
    "title"                TEXT         NOT NULL DEFAULT '',
    "message"              TEXT         NOT NULL DEFAULT '',
    "scope"                JSONB        NOT NULL,
    "permission"           TEXT         NOT NULL DEFAULT 'view',
    "share_jti"            TEXT,
    "share_path"           TEXT         NOT NULL,
    "share_url"            TEXT         NOT NULL,
    "password_protected"   BOOLEAN      NOT NULL DEFAULT false,
    "expires_at"           TIMESTAMP(3),
    "invited_by_user_id"   TEXT,
    "invited_by_username"  TEXT,
    "status"               TEXT         NOT NULL DEFAULT 'created',
    "email_sent_at"        TIMESTAMP(3),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "share_invitations_email_idx"     ON "share_invitations"("email");
CREATE INDEX IF NOT EXISTS "share_invitations_share_jti_idx" ON "share_invitations"("share_jti");
CREATE INDEX IF NOT EXISTS "share_invitations_status_idx"    ON "share_invitations"("status");

CREATE TABLE IF NOT EXISTS "share_comments" (
    "id"          TEXT         NOT NULL,
    "item_id"     TEXT         NOT NULL,
    "text"        TEXT         NOT NULL,
    "author_name" TEXT         NOT NULL,
    "author_type" TEXT         NOT NULL DEFAULT 'share_link',
    "share_jti"   TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "share_comments_item_id_idx"   ON "share_comments"("item_id");
CREATE INDEX IF NOT EXISTS "share_comments_share_jti_idx" ON "share_comments"("share_jti");

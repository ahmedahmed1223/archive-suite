-- Record version history
CREATE TABLE IF NOT EXISTS "record_versions" (
  "id"         BIGSERIAL PRIMARY KEY,
  "store"      TEXT        NOT NULL,
  "record_uid" TEXT        NOT NULL,
  "version"    INTEGER     NOT NULL DEFAULT 1,
  "snapshot"   JSONB       NOT NULL,
  "user_id"    TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_record_versions_lookup"
  ON "record_versions" ("store", "record_uid", "version" DESC);

-- Keep only the latest 50 versions per record (cleanup trigger)
CREATE OR REPLACE FUNCTION trim_record_versions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "record_versions"
  WHERE "store" = NEW.store
    AND "record_uid" = NEW.record_uid
    AND "version" NOT IN (
      SELECT "version" FROM "record_versions"
      WHERE "store" = NEW.store AND "record_uid" = NEW.record_uid
      ORDER BY "version" DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_record_versions ON "record_versions";
CREATE TRIGGER trg_trim_record_versions
  AFTER INSERT ON "record_versions"
  FOR EACH ROW EXECUTE FUNCTION trim_record_versions();

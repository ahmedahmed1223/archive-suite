-- AlterTable: add audit timestamp columns
-- createdAt defaults to now() for all existing rows; updatedAt tracks last write.
ALTER TABLE "storage_rows"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Trigger to auto-update updatedAt on every row change.
-- Prisma's @updatedAt relies on the client setting this value; the trigger
-- provides a DB-level safety net for direct SQL writes.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_rows_updated_at
  BEFORE UPDATE ON "storage_rows"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

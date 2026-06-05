-- CreateTable
CREATE TABLE "storage_rows" (
    "store" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "syncVersion" INTEGER,
    "lastModifiedBy" JSONB,

    CONSTRAINT "storage_rows_pkey" PRIMARY KEY ("store","uid")
);

-- CreateIndex
CREATE INDEX "storage_rows_store_idx" ON "storage_rows"("store");

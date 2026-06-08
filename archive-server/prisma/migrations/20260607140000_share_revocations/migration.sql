CREATE TABLE "share_revocations" (
  "jti" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "share_revocations_pkey" PRIMARY KEY ("jti")
);

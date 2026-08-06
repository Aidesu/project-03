-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SESSION_REVOKED';

-- AlterTable
ALTER TABLE "RefreshSession" ADD COLUMN     "familyCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "RefreshSession_userId_revokedAt_expiresAt_idx" ON "RefreshSession"("userId", "revokedAt", "expiresAt");

-- Backfill: a family's start is the oldest row carrying its id. Without this,
-- every session that already exists would claim it began at migration time,
-- and "signed in since" would be wrong on every device currently connected.
-- Idempotent — re-running recomputes the same value.
UPDATE "RefreshSession" s
SET "familyCreatedAt" = f."startedAt"
FROM (
  SELECT "familyId", MIN("createdAt") AS "startedAt"
  FROM "RefreshSession"
  GROUP BY "familyId"
) f
WHERE s."familyId" = f."familyId";

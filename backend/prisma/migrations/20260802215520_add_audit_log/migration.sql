-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_CHANGED', 'EMAIL_VERIFICATION_SENT', 'EMAIL_VERIFIED', 'ACCOUNT_DELETED', 'REFRESH_TOKEN_REUSE_DETECTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "userId" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_occurredAt_idx" ON "AuditLog"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- Append-only, enforced by the database rather than by convention: an audit
-- trail that application code can rewrite proves nothing during an incident.
-- The application can still INSERT (it must) and DELETE (that is how the
-- retention window is applied), but it cannot alter an event already recorded
-- — including through an ORM bug or a compromised application credential.
--
-- Reversible: DROP TRIGGER "audit_log_no_update" ON "AuditLog";
--             DROP FUNCTION "audit_log_reject_update"();
CREATE OR REPLACE FUNCTION "audit_log_reject_update"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: UPDATE is not permitted';
END;
$$;

CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_reject_update"();

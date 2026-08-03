-- Idempotency key for XP awards that must land at most once per subject.
-- NULL means "repeatable" and is the default: NULLs never collide in a Postgres
-- unique index, so unkeyed awards are unaffected.
ALTER TABLE "XpEvent" ADD COLUMN "dedupeKey" TEXT;

-- Backfill the per-application milestones already granted, so the fix applies
-- to existing accounts instead of only to rows written from now on.
--
-- Only the earliest row of each (user, reason, application) group gets a key.
-- The extra rows a farmed status loop produced stay NULL: they are XP that was
-- really credited to the profile total, and rewriting history here would make
-- the ledger stop reconciling with `GamificationProfile.xp`. Keying the first
-- one is enough to close the loop going forward.
WITH first_award AS (
  SELECT DISTINCT ON ("userId", "reason", "applicationId")
         "id", "reason", "applicationId"
  FROM "XpEvent"
  WHERE "applicationId" IS NOT NULL
    AND "reason" IN (
      'APPLICATION_CREATED',
      'APPLICATION_SUBMITTED',
      'INTERVIEW_SCHEDULED',
      'OFFER_RECEIVED',
      'OFFER_ACCEPTED'
    )
  ORDER BY "userId", "reason", "applicationId", "createdAt", "id"
)
UPDATE "XpEvent" e
SET "dedupeKey" = f."reason"::text || ':' || f."applicationId"
FROM first_award f
WHERE e."id" = f."id";

-- INTERVIEW_COMPLETED is deliberately left out of the backfill: historic rows
-- carry only the application, and an application can legitimately hold several
-- completed interviews, so keying them per application would suppress a real
-- award. Those rows stay NULL, which means each pre-existing interview can earn
-- its 25 XP one final time before the new key takes over.
CREATE UNIQUE INDEX "XpEvent_userId_dedupeKey_key" ON "XpEvent"("userId", "dedupeKey");

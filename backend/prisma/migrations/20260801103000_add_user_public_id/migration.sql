-- Adds the opaque public identifier for User.
--
-- Expand-then-contract, so no step is destructive and an old app version
-- keeps running against the intermediate schema:
--   1. the column lands nullable and unconstrained,
--   2. every existing row is backfilled,
--   3. only then does it become required and unique.
--
-- Reversal is a single `DROP COLUMN "publicId"`: the internal integer primary
-- key and all 27 foreign keys referencing it are untouched.

-- 1. Expand.
ALTER TABLE "User" ADD COLUMN "publicId" TEXT;

-- 2. Backfill. gen_random_uuid() is built into PostgreSQL 13+, so this needs
--    no pgcrypto extension.
UPDATE "User" SET "publicId" = gen_random_uuid()::text WHERE "publicId" IS NULL;

-- 3. Contract.
ALTER TABLE "User" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

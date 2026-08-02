-- DESTRUCTIVE MIGRATION — reverses 20260801044358_add_company_directory.
--
-- The public "Discover" directory is withdrawn: nothing in this product is
-- shared across users any more. Both tables and the Company FK are dropped,
-- so every aggregated directory row and every rating is permanently deleted.
-- There is no down migration; restoring the feature means restoring a backup
-- taken before this ran.

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_directoryCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyReview" DROP CONSTRAINT "CompanyReview_directoryCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyReview" DROP CONSTRAINT "CompanyReview_userId_fkey";

-- DropIndex
DROP INDEX "Company_directoryCompanyId_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "directoryCompanyId";

-- DropTable
DROP TABLE "CompanyReview";

-- DropTable
DROP TABLE "DirectoryCompany";

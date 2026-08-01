-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "directoryCompanyId" TEXT;

-- CreateTable
CREATE TABLE "DirectoryCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "websiteDomain" TEXT,
    "normalizedName" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "size" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyReview" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "directoryCompanyId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "didRespond" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectoryCompany_normalizedName_idx" ON "DirectoryCompany"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryCompany_websiteDomain_key" ON "DirectoryCompany"("websiteDomain");

-- CreateIndex
CREATE INDEX "CompanyReview_directoryCompanyId_idx" ON "CompanyReview"("directoryCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReview_userId_directoryCompanyId_key" ON "CompanyReview"("userId", "directoryCompanyId");

-- CreateIndex
CREATE INDEX "Company_directoryCompanyId_idx" ON "Company"("directoryCompanyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_directoryCompanyId_fkey" FOREIGN KEY ("directoryCompanyId") REFERENCES "DirectoryCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_directoryCompanyId_fkey" FOREIGN KEY ("directoryCompanyId") REFERENCES "DirectoryCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

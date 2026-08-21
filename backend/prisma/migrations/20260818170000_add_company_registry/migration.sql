-- CreateTable
CREATE TABLE "CompanyRegistryEntry" (
    "id" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "siren" TEXT NOT NULL,
    "name" TEXT,
    "naf" TEXT,
    "addressLine" TEXT,
    "postalCode" TEXT,
    "commune" TEXT,
    "departmentCode" TEXT,
    "regionCode" TEXT,
    "status" TEXT NOT NULL,
    "isDiffusible" BOOLEAN NOT NULL DEFAULT true,
    "sourceUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyRegistryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrySyncState" (
    "id" TEXT NOT NULL,
    "lastCursor" TEXT,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastIncrementalSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastError" TEXT,

    CONSTRAINT "RegistrySyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRegistryEntry_siret_key" ON "CompanyRegistryEntry"("siret");

-- CreateIndex
CREATE INDEX "CompanyRegistryEntry_departmentCode_idx" ON "CompanyRegistryEntry"("departmentCode");

-- CreateIndex
CREATE INDEX "CompanyRegistryEntry_regionCode_idx" ON "CompanyRegistryEntry"("regionCode");

-- CreateIndex
CREATE INDEX "CompanyRegistryEntry_name_idx" ON "CompanyRegistryEntry"("name");
